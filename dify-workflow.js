const { TextDecoder } = require('util');

class WorkflowClient {
  constructor(apiKey, baseUrl) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async sendRequest(method, endpoint, data = null, params = null, stream = false) {
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    let url = `${this.baseUrl}${endpoint}`;
    if (params && method === 'GET') {
      const searchParams = new URLSearchParams(params);
      url += '?' + searchParams.toString();
    }

    const options = { method, headers };
    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    
    if (stream) {
      return { data: response };
    }

    const jsonData = await response.json();
    return { data: jsonData };
  }

  info(user) {
    return this.sendRequest('GET', '/info', null, { user });
  }

  run(inputs, user, stream) {
    const data = {
      inputs,
      response_mode: stream ? "streaming" : "blocking",
      user
    };
    return this.sendRequest('POST', '/workflows/run', data, null, stream);
  }

  result(task_id) {
    return this.sendRequest('GET', `/workflows/run/${task_id}`);
  }

  async getWorkflowResult(input, user, isStream) {
    const res = await this.run(input, user, isStream);
    
    const asyncSSE = (stream) => {
      return new Promise(async (resolve) => {
        let task_id = '';
        let nodeRunning = false;
        const reader = stream.body.getReader();
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) break;
            
            const streams = new TextDecoder('utf-8').decode(value, { stream: true }).split('\n');
            streams.forEach(stream => {
              if (stream && stream.startsWith('data: ')) {
                let res = {};
                try {
                  res = JSON.parse(stream.substring(6)) || {};
                } catch (e) {
                  return;
                }

                if (!res.event || res.event === 'error' || res.status === 400) {
                  console.log(`工作流输出错误code:${res.code}`, res.message);
                  return;
                }
                if (res.event === 'workflow_started' || res.event === 'tts_message') {
                  task_id = res?.workflow_run_id;
                  console.log('工作流开始执行');
                }
                if (res.event === 'node_started') {
                  task_id = res?.workflow_run_id;
                  if (!nodeRunning) {
                    console.log('工作流node节点执行任务中');
                    nodeRunning = true;
                  }
                }
                if (res.event === 'node_finished') {
                  task_id = res?.workflow_run_id;
                }
                if (res.event === 'workflow_finished' || res.event === 'tts_message_end') {
                  console.log('工作流执行完毕，正在组装数据进行发送');
                  task_id = res?.workflow_run_id;
                }
              }
            });
          }
          
          if (task_id) {
            const resultResponse = await this.result(task_id);
            console.log('获取工作流执行结果', task_id, JSON.stringify(resultResponse.data.outputs));
            let outputs = {};
            if (resultResponse.data.outputs) {
              try {
                outputs = JSON.parse(resultResponse.data.outputs);
              } catch (error) {
                console.log(`获取工作流执行结果,失败:${error}`);
              }
            }
            resolve({ text: outputs?.text, task_id: task_id });
          } else {
            resolve({ text: '', task_id: '' });
          }
        } catch (e) {
          resolve({ text: `Dify工作流执行出错，${e}`, task_id: '' });
        }
      });
    };

    if (!isStream) {
      if (res.data.code) {
        console.log('Dify 工作流执行失败', res.data.code, res.data.message);
        return Promise.reject(res.data.message);
      }
      return {
        text: res.data?.data?.outputs?.text || '',
        task_id: res.data?.task_id,
      };
    } else {
      console.log('进入Dify工作流，请耐心等待...');
      const result = await asyncSSE(res.data);
      return result;
    }
  }
}

class WorkflowTask {
  constructor(dify) {
    this.dify = dify;
    this.taskName = "Dify工作流任务";
  }

  async run() {
    const DIFY_BASE_URL = process.env.DIFY_BASE_URL || 'https://api.dify.ai/v1';
    if (!DIFY_BASE_URL) {
      throw new Error("没有配置Dify api地址，请检查后执行!");
    }
    let inputs = {};
    try {
      inputs = process.env.DIFY_INPUTS ? JSON.parse(process.env.DIFY_INPUTS) : {};
    } catch (error) {
      console.error('DIFY_INPUTS 格式错误，请确保是json格式, 可能会影响任务流执行');
    }
    const user = "dify-schedule";
    const workflow = new WorkflowClient(this.dify.token, DIFY_BASE_URL);
    console.log(`正在获取Dify工作流基础信息...`);
    const info = await workflow.info(user);
    this.workfolwName = info.data?.name || "";
    console.log(`Dify工作流【${info.data.name}】开始执行...`);
    const response = await workflow.getWorkflowResult(inputs, user, true);
    this.result = response.text || "";
  }

  toString() {
    return this.result;
  }
}

(async () => {
  let tokensArr = [];
  if (process.env.DIFY_TOKENS) {
    if (process.env.DIFY_TOKENS.indexOf(";") > -1) {
      tokensArr = process.env.DIFY_TOKENS.split(";");
    } else if (process.env.DIFY_TOKENS.indexOf("\n") > -1) {
      tokensArr = process.env.DIFY_TOKENS.split("\n");
    } else {
      tokensArr = [process.env.DIFY_TOKENS];
    }
  }
  tokensArr = [...new Set(tokensArr.filter((item) => !!item))];
  console.log(`\n====================共${tokensArr.length}个Dify工作流=========\n`);

  if (!tokensArr[0]) {
    console.log("【提示】请先填写Dify工作流token");
    return;
  }

  let messageList = [];
  for (let token of tokensArr) {
    const workflow = new WorkflowTask({ token });
    await workflow.run();
    const content = workflow.toString();
    console.log(content);
    messageList.push(content);
  }

  const message = messageList.join(`\n${"-".repeat(15)}\n`);
  console.log(message);
})()
  .catch((e) => {
    console.log(`❌ 失败! 原因: ${e}!`);
  });
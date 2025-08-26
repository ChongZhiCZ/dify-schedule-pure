# Dify 工作流调度器

基于 [dify-schedule](https://github.com/leochen-g/dify-schedule) 项目重构的精简版本。

## ✨ 特性

- **单文件执行** - 无需复杂依赖，只需 Node.js
- **CommonJS 格式** - 兼容青龙面板等环境  
- **零外部依赖** - 使用 Node.js 内置 fetch API
- **多 Token 支持** - 批量执行多个工作流
- **流式处理** - 实时显示执行进度

## 🚀 快速开始

### 环境要求
- Node.js 18+ (支持内置 fetch)

### 青龙面板部署

1. **上传脚本**
   ```bash
   # 将 dify-workflow.js 上传到青龙面板脚本目录
   ```

2. **配置环境变量**
   ```bash
   DIFY_TOKENS=your-token-here              # 必填：工作流Token，多个用分号分隔
   DIFY_BASE_URL=https://api.dify.ai/v1     # 可选：API地址，默认官方地址
   DIFY_INPUTS={"key":"value"}              # 可选：工作流输入参数(JSON格式)
   ```

3. **添加定时任务**
   ```bash
   # 任务命令
   node dify-workflow.js
   
   # 定时表达式示例
   0 9 * * *  # 每天上午9点执行
   ```

## 📋 使用说明

### Token 获取
1. 进入 Dify 工作区
2. 选择需要调度的工作流
3. 点击「发布」→「API访问」
4. 复制 API Key 作为 Token

### 多 Token 配置
```bash
# 分号分隔
DIFY_TOKENS=token1;token2;token3

# 或换行分隔
DIFY_TOKENS=token1
token2
token3
```

### 输入参数配置
```bash
# JSON 格式的工作流输入参数
DIFY_INPUTS={"user_name":"张三","task_type":"daily"}
```

## 🛠 本地测试

```bash
# 设置环境变量后直接运行
export DIFY_TOKENS="your-token"
export DIFY_BASE_URL="https://api.dify.ai/v1"  
export DIFY_INPUTS='{"key":"value"}'

node dify-workflow.js
```

## 📄 License

ISC License

---

> 如有问题，请参考原项目：https://github.com/leochen-g/dify-schedule
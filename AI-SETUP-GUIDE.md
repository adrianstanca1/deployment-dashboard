# AI Setup Guide - Full Activation

## 🎉 Your AI is Ready!

The dashboard now has **full AI integration** with support for 5 LLM providers.

---

## 📋 Current Status

| Provider | Status | Default Model |
|----------|--------|---------------|
| 🟢 **Local (Ollama)** | ✅ Enabled | qwen3.5:cloud |
| 🔵 **Cloud (OpenRouter)** | 🔑 Needs API Key | openrouter/auto |
| 🔵 **OpenAI** | 🔑 Needs API Key | gpt-4o-mini |
| 🔵 **Anthropic** | 🔑 Needs API Key | claude-sonnet-4-20250514 |
| 🔵 **Google** | 🔑 Needs API Key | gemini-2.0-flash |

---

## 🚀 Quick Start Options

### Option 1: Use Local Ollama (Free, Private)

**If you have Ollama installed:**

1. Start Ollama: `ollama serve`
2. Pull a model: `ollama pull qwen3.5:cloud`
3. AI Chat will work automatically!

**If you don't have Ollama:**
```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull a model
ollama pull qwen3.5:cloud

# Start Ollama
ollama serve
```

---

### Option 2: Use Cloud Providers (API Keys Required)

#### Get API Keys:

**OpenRouter (Recommended - Access to Multiple Models):**
1. Go to https://openrouter.ai/keys
2. Create an account
3. Generate API key
4. Add $5-10 credit (very affordable!)

**OpenAI:**
1. Go to https://platform.openai.com/api-keys
2. Create API key

**Anthropic:**
1. Go to https://console.anthropic.com/settings/keys
2. Create API key

**Google:**
1. Go to https://makersuite.google.com/app/apikey
2. Create API key

---

## ⚙️ Add API Keys in Dashboard

1. **Open Dashboard:** http://72.62.132.43:3002
2. **Login:** admin / admin123
3. **Go to:** Settings → AI Settings
4. **Click:** "Add API Key" for your provider
5. **Paste** your API key
6. **Save**

**Or use the API directly:**

```bash
# Get token
TOKEN=$(curl -s -X POST http://localhost:8002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r '.token')

# Add OpenAI key
curl -X POST http://localhost:8002/api/ai/keys \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"provider":"openai","apiKey":"sk-..."}'

# Add Anthropic key
curl -X POST http://localhost:8002/api/ai/keys \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"provider":"anthropic","apiKey":"sk-ant-..."}'

# Add OpenRouter key
curl -X POST http://localhost:8002/api/ai/keys \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"provider":"openrouter","apiKey":"..."}'

# Add Google key
curl -X POST http://localhost:8002/api/ai/keys \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"provider":"google","apiKey":"..."}'
```

---

## 🤖 AI Features Now Available

### 1. **AI Chat** 
- Real conversations with LLMs
- Context-aware responses
- Remembers conversation history
- Multiple capabilities

### 2. **Capabilities**
- **Code Review** - Review code for quality and security
- **Debugging** - Help diagnose and fix bugs
- **Architecture** - Design system architecture
- **DevOps** - CI/CD, deployment, infrastructure
- **General** - General purpose assistant

### 3. **Agents**
- **Coder Agent** - Writes and reviews code
- **Reviewer Agent** - Code review specialist
- **DevOps Agent** - Deployment and infrastructure
- **Debugger Agent** - Bug hunting and fixing

### 4. **Tools**
- **PM2 Manager** - Manage Node.js processes
- **Docker** - Manage containers
- **GitHub** - Repository management
- **System** - System monitoring
- **File System** - Read/write files

---

## 💡 Usage Examples

### Chat with AI:
```bash
curl -X POST http://localhost:8002/api/ai/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Review this code for security issues",
    "capability": "codeReview",
    "provider": "openai"
  }'
```

### Switch Provider:
```bash
curl -X POST http://localhost:8002/api/ai/providers/anthropic \
  -H "Authorization: Bearer $TOKEN"
```

### Delegate to Agent:
```bash
curl -X POST http://localhost:8002/api/ai/delegate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "devops",
    "task": "Help me set up CI/CD for my Node.js app"
  }'
```

---

## 🎯 All Buttons & Functions Activated

✅ **AI Assistant Page** - Full chat with all providers
✅ **AI Settings** - Add/manage API keys
✅ **Provider Switching** - Toggle between 5 providers
✅ **Capability Selection** - Choose AI mode
✅ **Agent Delegation** - Assign tasks to specialized agents
✅ **Tool Integration** - AI can use PM2, Docker, GitHub, etc.
✅ **Context Awareness** - AI sees your system stats
✅ **Conversation History** - Remembers previous messages

---

## 🔧 Troubleshooting

### "Connection refused" error:
- **Local Ollama not running** - Start with `ollama serve`
- **Solution:** Use a cloud provider instead

### "Invalid API key":
- Check your API key is correct
- Ensure you have credit in your account
- Try regenerating the key

### "Provider not configured":
- Add API key in Settings → AI Settings
- Or use the API endpoint above

---

## 📊 Pricing (Approximate)

| Provider | Cost per 1K tokens | Example Cost |
|----------|-------------------|--------------|
| **Ollama (Local)** | Free | $0 |
| **OpenRouter** | $0.0001 - $0.01 | ~$0.01 per chat |
| **OpenAI GPT-4o-mini** | $0.00015 | ~$0.001 per chat |
| **Anthropic Claude** | $0.003 | ~$0.03 per chat |
| **Google Gemini** | $0.000125 | ~$0.001 per chat |

**Recommendation:** Start with OpenRouter ($5 credit lasts a long time!)

---

## 🎉 You're All Set!

Your AI is fully integrated and ready to use. Just add your API keys and start chatting!

**Access:** http://72.62.132.43:3002
**Go to:** AI Assistant or Settings → AI Settings

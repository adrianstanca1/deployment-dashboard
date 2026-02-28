# How to Use OpenClaw Skills

## What are Skills?

Skills are pre-built modules that give you specialized capabilities. Think of them as plugins that extend what I can do for you.

## Available Skills (Top Picks)

### 🤖 **coding-agent**
Delegate coding tasks to AI agents (Codex, Claude Code, Pi).

**Use when:**
- Building new features or apps
- Reviewing PRs
- Refactoring large codebases
- Iterative coding that needs file exploration

**Example:**
```
"Use coding-agent to create a REST API with Express"
"Use coding-agent to review this PR"
```

---

### 🐙 **github**
GitHub operations via `gh` CLI.

**Use when:**
- Checking PR status or CI
- Creating/commenting on issues
- Listing/filtering PRs or issues
- Viewing run logs

**Example:**
```
"Use github to list my open PRs"
"Use github to check CI status on main branch"
```

---

### 💬 **discord**
Discord operations via message tool.

**Use when:**
- Sending messages to Discord channels
- Managing Discord reactions
- Creating Discord topics

**Example:**
```
"Use discord to send a message to #general"
```

---

### 🌤️ **weather**
Get current weather and forecasts.

**Use when:**
- User asks about weather/temperature
- Planning outdoor activities

**Example:**
```
"Use weather to check forecast for London"
"What's the weather in Tokyo?"
```

---

### 🔒 **healthcheck**
Security hardening and risk-tolerance configuration.

**Use when:**
- Security audits needed
- Firewall/SSH/update hardening
- Exposure review
- Periodic security checks

**Example:**
```
"Use healthcheck to audit my system security"
```

---

### 🖼️ **openai-image-gen**
Batch-generate images via OpenAI Images API.

**Use when:**
- Need multiple images generated
- Want to create an image gallery

**Example:**
```
"Use openai-image-gen to create 10 landscape images"
```

---

### 🎙️ **openai-whisper** / **openai-whisper-api**
Speech-to-text transcription.

**Use when:**
- Need to transcribe audio files
- Convert speech to text

**Example:**
```
"Use openai-whisper to transcribe this audio file"
```

---

### 📹 **video-frames**
Extract frames or clips from videos.

**Use when:**
- Need screenshots from video
- Want to create GIFs from video

**Example:**
```
"Use video-frames to extract frames from video.mp4"
```

---

### 📊 **session-logs**
Search and analyze session logs.

**Use when:**
- Need to find previous conversations
- Analyzing past decisions

**Example:**
```
"Use session-logs to find when we discussed the API"
```

---

### 🛠️ **skill-creator**
Create or update AgentSkills.

**Use when:**
- Designing new skills
- Packaging skills with scripts

**Example:**
```
"Use skill-creator to make a new skill for X"
```

---

### 🔧 **mcporter**
MCP server CLI tool.

**Use when:**
- Need to call MCP servers/tools
- Configure MCP servers

**Example:**
```
"Use mcporter to list available MCP tools"
```

---

### 📦 **clawhub**
Install/publish skills from clawhub.com.

**Use when:**
- Need to fetch new skills
- Sync installed skills
- Publish your own skills

**Example:**
```
"Use clawhub to install the latest skills"
"Use clawhub to publish my new skill"
```

---

### 📰 **gh-issues**
Auto-fix GitHub issues and open PRs.

**Use when:**
- Want to automatically fix bugs
- Monitor and address PR reviews

**Example:**
```
"Use gh-issues to fix bugs in my repo"
```

---

### 🔮 **oracle**
Oracle CLI best practices.

**Use when:**
- Using oracle for prompts
- File bundling with oracle

**Example:**
```
"Use oracle to analyze this codebase"
```

---

### 📝 **apple-notes** / **apple-reminders** / **bear-notes**
Apple ecosystem integration.

**Use when:**
- Need to read/write Apple Notes
- Manage reminders
- Access Bear notes

---

### 🔐 **1password**
1Password integration.

**Use when:**
- Need to access passwords securely

---

### 🎨 **gifgrep**
Search GIFs.

**Use when:**
- Need to find reaction GIFs

---

### 📡 **bluebubbles** / **camsnap** / **eightctl**
Specialized hardware/service integrations.

---

## How to Use a Skill

Just tell me:
1. **Which skill** you want to use
2. **What you want to accomplish**

### Examples:

✅ "Use the **weather** skill to check the forecast for Paris"

✅ "Use **coding-agent** to build a React component for a login form"

✅ "Use **github** to list all my repositories"

✅ "Use **healthcheck** to audit my server security"

✅ "Use **clawhub** to install the latest version of all skills"

---

## Pro Tips

1. **Be specific** - Tell me exactly what you want
2. **One skill at a time** - Each request should use one skill
3. **I'll read the skill docs** - When you mention a skill, I'll automatically read its SKILL.md for detailed instructions
4. **Skills are read-only by default** - I'll ask before making destructive changes

---

## Want to See All Skills?

```bash
ls /usr/lib/node_modules/openclaw/skills/
```

Or just ask: "What skills are available?"

---

**Ready to use a skill? Just tell me which one!** 🚀

# Viz Vibe for Claude Code

Visual Context Map for AI Coding - Claude Code 사용자를 위한 설치 가이드입니다.

## 🚀 Quick Install (Global)

**글로벌 설치** - 한 번 설치하면 모든 프로젝트에서 사용 가능합니다:

```bash
curl -fsSL https://raw.githubusercontent.com/NamHyeongKeol/viz-vibe/main/claude-code/global-install.sh | bash
```

### 설치 후 사용법

```bash
# 1. 새 터미널 열기 (PATH 반영)
# 2. 프로젝트 디렉토리로 이동
cd your-project

# 3. vizvibe 초기화
vizvibe init

# 4. Claude Code 시작 - 자동으로 trajectory를 감지합니다!
claude
```

### 글로벌 제거

```bash
curl -fsSL https://raw.githubusercontent.com/NamHyeongKeol/viz-vibe/main/claude-code/global-uninstall.sh | bash
```

---

## 📦 Legacy Install (Per-Project)

기존 프로젝트별 설치 방식도 여전히 지원됩니다:

```bash
# 프로젝트 디렉토리에서 실행
curl -fsSL https://raw.githubusercontent.com/NamHyeongKeol/viz-vibe/main/claude-code/install.sh | bash
```

### 프로젝트별 제거

```bash
curl -fsSL https://raw.githubusercontent.com/NamHyeongKeol/viz-vibe/main/claude-code/uninstall.sh | bash
```

---

## 📂 설치 구조

### 글로벌 설치 시

```
~/.vizvibe/
├── bin/
│   └── vizvibe           # CLI 스크립트
├── scripts/
│   ├── read-vizvibe.js   # SessionStart hook
│   └── update-vizvibe.js # Stop hook
├── skills/
│   └── vizvibe/
│       └── SKILL.md      # AI skill 문서
└── templates/
    └── vizvibe.mmd       # 템플릿

~/.claude/
├── hooks/
│   ├── read-vizvibe.js   # (복사됨)
│   ├── update-vizvibe.js # (복사됨)
│   └── VIZVIBE.md        # (복사됨)
├── skills/
│   └── vizvibe/
│       └── SKILL.md      # (복사됨)
└── settings.json         # hooks 설정
```

---

## 🔧 CLI Commands

| Command           | Description                      |
| ----------------- | -------------------------------- |
| `vizvibe init`    | 현재 디렉토리에 vizvibe.mmd 생성 |
| `vizvibe help`    | 도움말 표시                      |
| `vizvibe version` | 버전 정보                        |

---

## 💡 Tips

- **VS Code/Cursor 사용자**: Viz Vibe extension을 설치하면 그래프 시각화를 볼 수 있습니다.
- **Antigravity 사용자**: Extension이 자동으로 GEMINI.md 에 규칙을 주입합니다.

---

## 🐛 Troubleshooting

### `vizvibe: command not found`

새 터미널을 열어 PATH 변경사항을 반영하세요:

```bash
source ~/.zshrc  # or ~/.bashrc
```

### hooks가 동작하지 않음

`~/.claude/settings.json`에 hooks가 올바르게 설정되어 있는지 확인하세요:

```json
{
  "hooks": {
    "SessionStart": [...],
    "Stop": [...]
  }
}
```

---

## 📖 More Info

- [Viz Vibe 메인 README](../README.md)
- [SKILL.md - AI용 trajectory 관리 가이드](./plugin/skills/vizvibe/SKILL.md)

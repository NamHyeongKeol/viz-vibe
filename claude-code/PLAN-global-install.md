# Global Install + Per-Project Init 구현 플랜

## 📋 개요

Claude Code 사용자들이 현재 각 프로젝트마다 별도로 설치해야 하는 불편함을 해소하기 위해,
VS Code extension처럼 **한 번 글로벌 설치 → 각 프로젝트에서 init만** 하는 방식으로 변경한다.

### 현재 문제점

- 각 레포마다 별도로 vizvibe를 설치해야 함
- 사용자들이 설치 과정을 헷갈려 함
- hooks, skills 등이 프로젝트마다 중복 설치됨

### 목표

- **글로벌 설치**: 한 번 설치하면 모든 프로젝트에서 사용 가능
- **프로젝트 Init**: 각 프로젝트에서 `vizvibe init`으로 vizvibe.mmd 템플릿만 생성
- **VS Code extension과 동일한 UX**: 설치 한 번 → 프로젝트마다 init만

---

## 🏗️ 구조 변경

### Before (현재)

```
viz-vibe/
├── claude-code/              # curl 설치 스크립트
│   ├── install.sh
│   └── templates/
│
└── vizvibe-plugin/           # Plugin 마켓플레이스용 (별도)
    ├── hooks/
    ├── skills/
    └── commands/
```

### After (변경 후)

```
viz-vibe/
└── claude-code/              # Claude Code 사용자를 위한 모든 것
    ├── plugin/               # 플러그인 본체 (마켓플레이스 + curl 공용)
    │   ├── .claude-plugin/
    │   │   └── plugin.json
    │   ├── hooks/
    │   │   ├── session-start.js
    │   │   └── stop.js
    │   ├── skills/
    │   │   └── vizvibe/
    │   │       └── SKILL.md
    │   ├── commands/
    │   │   ├── init.md
    │   │   ├── update.md
    │   │   └── status.md
    │   └── templates/
    │       └── vizvibe.mmd.template
    │
    ├── bin/
    │   └── vizvibe           # CLI 스크립트 (vizvibe init 등)
    │
    ├── install.sh            # 글로벌 설치 스크립트
    ├── uninstall.sh          # 제거 스크립트
    └── README.md
```

---

## 📝 구현 단계

### Phase 1: 폴더 구조 정리

1. [ ] `vizvibe-plugin/` 내용을 `claude-code/plugin/`으로 이동
2. [ ] `vizvibe-plugin/` 폴더 삭제
3. [ ] 기존 `claude-code/templates/` 정리

### Phase 2: SKILL.md 작성

1. [ ] 통합 SKILL.md 작성
   - Initial Draft Creation (git history, README, 대화 기반)
   - Updating Existing Trajectory (노드 추가/수정/삭제)
   - Common Rules (스타일, 노드 형식, 연결 방식)
   - Complete Example

### Phase 3: Hook 정리

1. [ ] `session-start.js` 업데이트
   - vizvibe.mmd 존재 시 컨텍스트 주입
   - 템플릿 상태면 초안 작성 요청
2. [ ] `stop.js` 업데이트
   - 세션 종료 시 vizvibe 업데이트 요청

### Phase 4: CLI 스크립트 작성

1. [ ] `bin/vizvibe` 스크립트 작성
   - `vizvibe init`: vizvibe.mmd 템플릿 생성
   - `vizvibe help`: 도움말 표시

### Phase 5: 글로벌 설치 스크립트

1. [ ] `install.sh` 업데이트
   - `~/.vizvibe/`에 plugin 파일들 복사
   - `~/.vizvibe/bin/`에 CLI 스크립트 복사
   - `~/.zshrc` 또는 `~/.bashrc`에 PATH 추가
   - `~/.claude/settings.json`에 글로벌 hooks 등록
2. [ ] `uninstall.sh` 업데이트

### Phase 6: 테스트

1. [ ] 새 터미널에서 설치 테스트
2. [ ] `vizvibe init` 동작 확인
3. [ ] Claude Code에서 hooks/skills 동작 확인

### Phase 7: 정리

1. [ ] README.md 업데이트
2. [ ] vizvibe.mmd 노드 상태 업데이트

---

## 🔧 기술 상세

### install.sh 동작

```bash
#!/bin/bash

VIZVIBE_HOME="$HOME/.vizvibe"
CLAUDE_HOME="$HOME/.claude"

# 1. ~/.vizvibe 설정
mkdir -p "$VIZVIBE_HOME/bin"
cp -r plugin/* "$VIZVIBE_HOME/"
cp bin/vizvibe "$VIZVIBE_HOME/bin/"
chmod +x "$VIZVIBE_HOME/bin/vizvibe"

# 2. PATH 등록
SHELL_RC="$HOME/.zshrc"  # or .bashrc
if ! grep -q "VIZVIBE_HOME" "$SHELL_RC"; then
    echo 'export VIZVIBE_HOME="$HOME/.vizvibe"' >> "$SHELL_RC"
    echo 'export PATH="$VIZVIBE_HOME/bin:$PATH"' >> "$SHELL_RC"
fi

# 3. Claude 글로벌 hooks 등록
mkdir -p "$CLAUDE_HOME/hooks"
cp "$VIZVIBE_HOME/hooks/"* "$CLAUDE_HOME/hooks/"

# 4. Claude 글로벌 skills 등록
mkdir -p "$CLAUDE_HOME/skills"
cp -r "$VIZVIBE_HOME/skills/"* "$CLAUDE_HOME/skills/"
```

### vizvibe CLI 스크립트

```bash
#!/bin/bash

case "$1" in
    init)
        if [ -f "vizvibe.mmd" ]; then
            echo "❌ vizvibe.mmd already exists!"
            exit 1
        fi
        cp "$VIZVIBE_HOME/templates/vizvibe.mmd.template" ./vizvibe.mmd
        echo "✅ Created vizvibe.mmd"
        echo "💡 Ask your AI agent to set up the initial trajectory!"
        ;;
    help|--help|-h)
        echo "Vizvibe - Visual Context Map for AI Coding"
        echo ""
        echo "Commands:"
        echo "  init    Create vizvibe.mmd in current directory"
        echo "  help    Show this help message"
        ;;
    *)
        echo "Unknown command: $1"
        echo "Run 'vizvibe help' for usage"
        exit 1
        ;;
esac
```

### Claude Code 글로벌 Hooks 우선순위

Claude Code hooks 우선순위 (낮음 → 높음):

1. `~/.claude/hooks/` (글로벌) ← 여기에 설치
2. `.claude/hooks/` (프로젝트 루트)
3. 로컬 hooks

Hook chaining: 배열로 여러 hook 객체 나열 시 위→아래 순서 실행.
앞 hook이 중단되면 뒤 hook도 실행 안 됨.

---

## 📌 참고

- 관련 vizvibe.mmd 노드: `claude_code_global_install`, `curl_global_install`, `brew_global_install`
- 브랜치: `feature/global-install-refactor`

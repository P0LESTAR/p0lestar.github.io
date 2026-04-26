---
title: Obsidian MCP 연동하기
date: 2025-08-05 20:55:00 +0800
category: etc
tags: [MCP, Obsidian]
---

# Obsidian MCP🤖

요즘 노션 대신 옵시디언이라는 노트 프로그램을 사용 중입니다.

옵시디언도 MCP를 지원한다길래 설치해 봤습니다.
<br>

## 'MCP Tools' 플러그인
커뮤니티 플러그인에서 검색하면 나옵니다.

![](https://velog.velcdn.com/images/backhoe/post/3dfe7f37-940c-4f66-b402-2527f76fc10e/image.png)

<br>

## 필수 옵션: REST API
설치 후 옵션을 열면 디펜던시가 필요하다고 나옵니다.
![](https://velog.velcdn.com/images/backhoe/post/6e3243d5-8336-41f7-ad2e-8ff448da6ae7/image.png)

### 로컬 REST API가 필요한 이유
옵시디언은 기본적으로 외부 프로그램이 접근할 수 없는 닫힌 시스템입니다. 
MCP 도구들이 옵시디언 노트를 읽고 쓰려면 중간 다리 역할을 할 인터페이스가 필요합니다.

> - 옵시디언과 외부 도구 간의 안전한 통신 창구 역할
> - HTTPS + API 키로 보안 제공
> - 노트 읽기/쓰기/검색 등의 표준화된 인터페이스 제공


이것도 커뮤니티 플러그인에서 설치하면 됩니다.

![](https://velog.velcdn.com/images/backhoe/post/e130c645-f786-4262-b740-8c44452e7cff/image.png)

두 플러그인 모두 활성화해 주세요.
<br>

## config.json
Install 버튼을 누르면 config.json에 자동으로 추가해 줍니다.
클로드를 재시작하면 MCP로 연동됩니다.
![](https://velog.velcdn.com/images/backhoe/post/d41bb23d-8d4d-44d5-bd8e-930a66cbcf0f/image.png)
<br>

## MCP tool 종류

![](https://velog.velcdn.com/images/backhoe/post/b0db85ac-5e92-43c2-a7ee-2e481b745b50/image.png)

> **파일 관리**
get_active_file: 현재 열린 파일 내용 가져오기
update_active_file: 활성 파일 내용 업데이트
append_to_active_file: 활성 파일에 내용 추가
patch_active_file: 특정 섹션(헤딩, 블록 등) 수정
delete_active_file: 활성 파일 삭제

> **볼트 관리**
list_vault_files: 볼트 파일 목록 조회
get_vault_file: 특정 파일 내용 가져오기
create_vault_file: 새 파일 생성
append_to_vault_file: 파일에 내용 추가
patch_vault_file: 파일의 특정 부분 수정
delete_vault_file: 파일 삭제

> **검색 기능**
search_vault: Dataview DQL 또는 JsonLogic으로 검색
search_vault_simple: 텍스트 기반 검색
search_vault_smart: 의미적 검색

> **기타**
show_file_in_obsidian: 옵시디언에서 파일 열기
execute_template: Templater 템플릿 실행
get_server_info: 서버 정보 확인
fetch: 웹 페이지 내용 가져오기

<br><br>

---

저는 PARA 노트 정리법을 사용해 보고 있는데, MCP로 자동 업로드 등을 사용할 때 접근성을 높이기 위해 Claude 폴더를 따로 추가해서 사용해 보려고 합니다.

Claude가 조회하거나 추가할 때 빠르게 처리하라는 의미도 있지만, 제가 찾기 쉽게 하려고 그렇게 했습니다.


[nodejs]: https://nodejs.org/
[starter]: https://github.com/cotes2020/chirpy-starter
[pages-workflow-src]: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site#publishing-with-a-custom-github-actions-workflow
[docker-desktop]: https://www.docker.com/products/docker-desktop/
[docker-engine]: https://docs.docker.com/engine/install/
[vscode]: https://code.visualstudio.com/
[dev-containers]: https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers
[dc-clone-in-vol]: https://code.visualstudio.com/docs/devcontainers/containers#_quick-start-open-a-git-repository-or-github-pr-in-an-isolated-container-volume
[dc-open-in-container]: https://code.visualstudio.com/docs/devcontainers/containers#_quick-start-open-an-existing-folder-in-a-container

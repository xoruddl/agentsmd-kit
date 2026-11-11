# 작업 흐름

## 1. 시작

- 요구사항이 불명확하면 먼저 질문한다.
- 이슈와 브랜치를 만든다. → [git-conventions.md](git-conventions.md)
- 커밋 계획을 목록으로 제시하고 승인을 받는다.

```
1. Order.java, OrderTest.java          — feat: 주문 취소 사유 필드 추가
2. OrderService.java, OrderServiceTest.java — feat: 주문 취소 로직 추가
```

## 2. 커밋 루프

1. 커밋 하나에 해당하는 변경을 한다.
2. 검증한다. (포맷, 빌드, 테스트 — 프로젝트에 있는 것만)
3. 커밋한다. → [git-conventions.md](git-conventions.md)
4. 보고하고 **멈춘다.**

보고 형식:

```
커밋: feat: 주문 취소 사유 필드 추가
파일: src/main/java/.../Order.java, src/test/java/.../OrderTest.java
다음: OrderService 에 취소 로직 추가 (2/2)
```

- 사용자가 진행 또는 피드백을 주기 전까지 다음 커밋을 하지 않는다.
- 피드백 반영은 새 커밋으로 한다.
- `--amend` 는 사용자가 요청하고, push 전일 때만 쓴다.

## 3. 커밋 크기

- 커밋 하나는 책임 하나. 커밋 제목을 한 줄로 쓰기 어렵거나 "및", "와/과"로 두 가지를 잇게 되면 책임이 섞인 것이니 나눈다.
- 대상 코드와 그 테스트는 같은 커밋에 둘 수 있다.
- 파일 수는 제한하지 않는다. 다만 바뀐 파일이 많아지면 책임이 하나인지 다시 본다.

## 4. PR

- 계획한 커밋이 끝나면 push 후 PR 을 만든다. → [git-conventions.md](git-conventions.md)
- PR 링크를 보고하고 멈춘다.
- 리뷰 확인은 [code-review.md](code-review.md).

## 금지

- 멈추지 않고 커밋 여러 개 연속 실행
- 요청 없는 리팩터링·정리 작업 끼워 넣기
- `--no-verify` 등 훅 우회
- main 직접 커밋·push

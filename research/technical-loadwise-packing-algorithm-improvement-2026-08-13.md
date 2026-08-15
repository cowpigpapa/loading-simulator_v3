---
topic: "LoadWise 컨테이너 적재 알고리즘 개선"
type: "technical"
goals: "현재 Extreme Points 기반 휴리스틱을 논문·공식 표준·검증 가능한 구현과 비교하고, 정확도·안전성·성능·검증 체계를 개선할 실행 로드맵 도출"
date: "2026-08-13"
methodology: "현재 코드 정적 분석, peer-reviewed 논문·공식 표준·공식 저장소 중심의 병렬 웹 조사. 사실과 설계 의견을 분리하고 출처·접근일·신뢰도를 기록한다."
---

# Research Report — LoadWise 적재 알고리즘 개선

> **유형:** 기술·학술 검토 | **기준일:** 2026-08-13
>
> **가정:** 브라우저에서 수 초 안에 결정론적으로 실행되고, 현장 검토용 안전 제약을 유지하며, 현재의 5개 전략 UI와 호환되어야 한다. 전역 최적해나 안전 인증을 약속하지 않는다.

## 현재 구현 기준선

현재 LoadWise는 모든 배치 화물의 끝 좌표를 조합해 후보점을 만들고, DBLF 성격의 점수로 회전·위치를 선택하는 Extreme Points 계열 휴리스틱이다. 안전·공간·폭·무게중심 전략과 이들을 비교하는 자동 추천을 제공하며, 경계·충돌·중량·상부 지지·취약 화물·원통 및 일부 측면 지지 조건을 하드 제약으로 검사한다. 이 단락은 2026-08-13 로컬 저장소의 `app.js`와 `ALGORITHM-POLICY.md`를 직접 분석한 결과다.

관찰 — 현재 후보점 생성은 실제 extreme point만 갱신하는 방식이 아니라 모든 X·Y·Z 끝 좌표의 데카르트 곱을 생성한다. 배치 수가 커질수록 유효하지 않거나 열등한 후보가 빠르게 늘 수 있고, 고정된 1회 정렬과 탐욕 배치 때문에 앞선 선택을 되돌리거나 미배치 화물을 재삽입하는 탐색이 없다. 자동 추천은 네 전략의 결과를 비교하지만 각 전략 내부는 사실상 단일 궤적이다.

## 조사 결과

### 알려진 접근법과 LoadWise 적합성

Crainic·Perboli·Tadei의 연구는 박스를 놓을 때 새로 생기는 실제 extreme point를 갱신하는 규칙이 배치 품질과 계산 효율에 중요하다고 설명한다. 현재 LoadWise의 끝 좌표 데카르트 곱은 이 개념의 간소화 버전이므로, 정식 EP 생성과 점유·경계·지배점 제거가 가장 먼저 손볼 부분이다. [Politecnico di Torino/INFORMS](https://iris.polito.it/handle/11583/1512183) (accessed 2026-08-13, Primary, confidence: High).

학술 문헌에서는 하나의 탐욕 순서에 의존하지 않고 구성 휴리스틱을 여러 번 실행하거나, 제한된 tree/beam search, block-building, GRASP·local search를 결합하는 흐름이 반복된다. 특히 동일 규격 화물을 block으로 묶고 일부 미래 선택을 탐색하는 방법은 완전 탐색 없이도 선행 배치의 실수를 줄인다. 반면 exact branch-and-bound나 MILP는 소형 문제의 검증에는 유용하지만 일반적인 브라우저 실시간 경로로 쓰기 어렵다. [Fanslau & Bortfeldt](https://www.fernuni-hagen.de/wirtschaftswissenschaft/forschung/download/beitraege/db426.pdf) (accessed 2026-08-13, Primary, confidence: High); [Martello·Pisinger·Vigo](https://doi.org/10.1287/opre.48.2.256.12386) (accessed 2026-08-13, Primary, confidence: High).

실무 컨테이너 적재는 기하학만의 문제가 아니다. 연구 문헌은 방향 제한, 적재 안정성, 내하력, 그룹·분리, 완전 선적, 하역 순서, 무게 배분 같은 제약을 별도 범주로 다룬다. CTU Code는 결합 무게중심, 집중하중, 고박 및 운송방향별 힘을 검토하도록 하며, 이는 LoadWise의 공간 최적화 점수와 분리된 feasibility/검증층이 필요하다는 근거가 된다. [Bortfeldt & Wäscher](https://doi.org/10.1016/j.ejor.2012.12.006) (accessed 2026-08-13, Primary, confidence: High); [UNECE CTU Code](https://unece.org/transport/intermodal-transport/imoilounece-code-practice-packing-cargo-transport-units-ctu-code) (accessed 2026-08-13, Primary, confidence: High).

### 핵심 설계 판단

관찰 — LoadWise에 맞는 차세대 엔진은 완전히 다른 단일 알고리즘이 아니라 다음 하이브리드다.

`입력 검증 → 동일 SKU block 후보 → seeded 다중 순서 → 정식 EP decoder → 위험 품목 제한 beam → 미배치 발생 시 tail destroy/reinsert → 독립 안전 validator → 사전식 다목적 비교`

첫째, `extremePoints()`를 증분형 EP 자료구조로 바꾼다. 박스 배치로 생긴 후보만 추가하고, 컨테이너 밖·점유 내부·다른 점에 지배되는 후보를 즉시 제거한다. 이 변경은 품질뿐 아니라 현재 후보 폭증을 줄여 이후 여러 탐색을 돌릴 시간 예산을 만든다.

둘째, 기존 decoder와 안전 조건은 유지하면서 6~12개의 결정론적 다중 시작을 사용한다. 체적, 바닥면, 최장변, 중량, 세장비, 취약도 기준 순서와 seeded GRASP의 제한 후보목록을 조합한다. 입력 해시를 seed로 사용하고 알고리즘 버전·seed·반복 횟수를 저장하면 같은 입력의 재현성을 보존할 수 있다.

셋째, 모든 단계에 비싼 탐색을 적용하지 않는다. 미배치 가능성이 큰 대형·원통·세장 화물이나 상위 후보 점수가 비슷한 순간에만 폭 3~8, 깊이 2~4의 beam lookahead를 켠다. 첫 결과에서 미배치가 생기면 마지막 10~20% 배치와 미배치 화물만 제거해 다시 삽입한다. 이 tail destroy-and-repair가 단일 탐욕의 가장 큰 약점인 되돌릴 수 없는 초반 선택을 직접 보완한다.

넷째, 동일 SKU가 많은 경우에만 `(nx, ny, nz, orientation)` block 후보를 만든다. block 내부는 완전 지지와 규칙적인 작업 순서를 제공하지만, 이종 화물에서는 빈 공간을 키울 수 있으므로 단품 EP와 혼합하고 benchmark로 채택 여부를 결정한다.

### 안전 판정층

현재의 지지면적 100% 또는 70%는 안전을 설명하는 하나의 신호일 뿐이다. 다음 버전은 각 화물의 접촉 사각형 합집합 또는 보수적인 convex hull을 지지다각형으로 만들고, 해당 화물과 그 위에 실린 subtree의 합성 CoG 수직 투영이 그 안에 있는지 검사해야 한다. 이렇게 하면 지지면적은 넓지만 한쪽으로 치우친 배치를 거르고, 안정적인 부분 지지를 무조건 금지하는 과잉 제약도 줄일 수 있다.

제품 데이터에 `maxTopLoadKg` 또는 `maxPressureKPa`가 있으면 겹침 면적 비율로 상부 하중을 아래 지지물에 전달해 누적 압축하중을 검사한다. 값이 없을 때는 통과로 간주하지 말고 `미검증`으로 표시한다. 바닥 화물에는 kg/m²와 길이 구간별 kg/m를 산출하되, 하드 제한값은 컨테이너 운영자 프로필이 제공될 때만 적용한다.

CTU 검사는 payload 하드 게이트와 무게중심·질량분포 경고를 분리한다. 질량가중 3축 CoG, 종·횡 편심, 수직 CoG, 길이 절반 구간에 포함된 질량 비율을 보고한다. 축하중은 트랙터·세미트레일러 축 위치와 허용하중이 없으면 계산하지 않는다. 밴드 수량 역시 마찰계수, 운송모드, 각도, STF/LC/MSL과 앵커 용량이 없으면 확정하지 않고 `고정 필요성·경로 예시`만 제공한다.

### 목적함수

현재 자동 추천의 사전식 비교는 방향이 맞다. 다만 다음처럼 명시적으로 계층화하는 편이 낫다.

1. 하드 제약 위반 0건
2. 미배치 수량과 미배치 우선순위
3. 컨테이너 총비용과 대수
4. 정적 안정성·압축하중·CTU 강경고 수
5. 그룹 분할과 하역 재취급 비용
6. CoG 위험과 중량분포
7. 공간 활용률, 적재 깊이, 빈 공간 파편화
8. 동률일 때 작업순서 단순성·고정재 검토 수

관찰 — 안전과 미배치를 가중합 하나로 섞으면 큰 공간 이득이 안전 위반을 상쇄하는 잘못된 해가 나올 수 있다. 하드 게이트와 사전식 목적을 먼저 적용하고, 연속 가중 점수는 같은 등급의 후보를 정렬할 때만 사용해야 한다.

### 검증 및 벤치마크

알고리즘 변경보다 먼저 `validateSolution(input, solution)`을 packer와 독립시킨다. 경계, 충돌, 회전, 수량, 중량, 지지, 내하력, 상부적재금지, 문 방향, 보고된 CoG·활용률을 원 입력에서 다시 계산해야 한다. KU Leuven의 3D-MCLP 자료가 solver와 독립 validator를 분리하는 구조를 제공하며, PackingSolver는 현실 제약이 포함된 오프라인 비교 기준으로 활용할 수 있다. [KU Leuven MCLP](https://benchmark.gent.cs.kuleuven.be/mclp/resources.html) (accessed 2026-08-13, Primary, confidence: High); [PackingSolver](https://github.com/fontanf/packingsolver) (accessed 2026-08-13, Primary, confidence: Medium).

벤치마크는 순수 기하, 다중 컨테이너, 현실 제약, 안전 회귀, adversarial, 익명화 현장 사례로 나눈다. 각 실행에 엔진 버전, 전략, seed, 입력 hash, 적재·미배치 수량/부피/중량, 컨테이너 수·비용, CoG 편차, 안전 위반, p50/p95 시간, validator 결과를 JSON으로 남긴다. 외부 데이터의 공개 다운로드 가능성과 재배포 라이선스는 별개이므로 KU Leuven·PackLib² 자료는 저장소 편입 전에 조건을 확인한다.

## 실행 우선순위

| 단계 | 변경 | 기대 효과 | 난이도 | 판정 |
|---|---|---:|---:|---|
| P0 | 독립 validator + 품질 benchmark | 개선을 수치로 증명, 안전 회귀 차단 | 중 | 가장 먼저 |
| P0 | 정식 EP 생성·지배점 제거 | 후보 폭증 감소, 탐색 예산 확보 | 중 | 가장 먼저 |
| P0 | seeded multi-start 6~12회 | 단일 정렬의 국소해 완화 | 중 | 바로 적용 |
| P0 | 합성 CoG 지지다각형 + CTU CoG 검사 | 안전성과 설명가능성 향상 | 중 | 바로 적용 |
| P1 | tail destroy-and-repair | 미배치·후반부 빈틈 복구 | 중 | 핵심 개선 |
| P1 | 조건부 beam search | 대형·위험 화물의 선행 선택 개선 | 중상 | 제한적으로 |
| P1 | 동일 SKU block-building | 반복화물 품질·속도·작업성 향상 | 중상 | 데이터 의존 |
| P1 | 누적 압축하중·바닥하중 | 현장 제약 확대 | 중상 | 입력 필드 필요 |
| P2 | 하역 순서·그룹·분리·완전선적 | 실무 계획성 향상 | 상 | 고객 요구 시 |
| P2 | 다중 컨테이너 전역 할당+LNS | 대수·비용·분할 개선 | 상 | 2차 엔진 |
| P3 | Web Worker 정밀 모드/BRKGA-lite | 더 긴 시간의 품질 탐색 | 상 | 선택 기능 |
| 보류 | RL/딥러닝 | 현장 데이터 없이는 검증 어려움 | 매우 상 | 지금 하지 않음 |
| 검증용 | MILP/CP/exact | 소형 사례 정답·상한 확인 | 상 | 제품 기본엔진 아님 |

## Key Findings

현재 LoadWise의 핵심 약점은 휴리스틱 종류가 적은 것이 아니라 각 전략이 한 번의 고정 순서 탐욕 경로에 의존하고, 후보점이 실제 EP보다 훨씬 넓게 생성된다는 점이다. 정식 EP와 다중 시작만으로도 기존 구조를 보존하면서 탐색 다양성과 계산 효율을 함께 개선할 여지가 크다.

관찰 — 가장 현실적인 vNext는 `EP + GRASP multi-start + 제한 beam + tail repair + 선택적 block`이다. GA·BRKGA 전체 도입이나 AI 학습보다 구현·설명·재현·브라우저 성능의 균형이 낫다.

안전성은 최적화 점수에 묻히면 안 된다. 지지다각형·합성 CoG·누적하중·CTU 검사로 독립된 feasibility layer를 만들고, 입력이 부족한 검사는 `통과`가 아니라 `미검증`으로 표현해야 한다.

알고리즘 성능 주장은 현재의 55개 안전 회귀만으로는 부족하다. 독립 validator와 외부 기준선, 품질·속도 benchmark가 먼저 있어야 이후 변경을 채택하거나 되돌릴 근거가 생긴다.

## Risks and Uncertainties

논문별 문제 정의와 제약이 달라 보고된 활용률을 LoadWise와 직접 비교할 수 없다. 실제 이득은 동일 입력·동일 제한시간·동일 validator로 재측정해야 한다. CTU Code는 글로벌 실무 코드지만 비강제적이며 개별 운송사·차량·지역 규정을 대체하지 않는다. 압축강도·바닥 허용하중·마찰·고박 용량이 없는 데이터에서는 정량 안전 판정을 완성할 수 없다.

## Next Steps

1. 현 엔진을 고정한 baseline benchmark와 독립 validator를 먼저 만든다.
2. 정식 EP와 multi-start를 각각 따로 적용해 품질·p95 시간을 비교한다.
3. 합성 CoG 지지다각형과 CTU CoG 게이트를 추가하고 안전 회귀를 확장한다.
4. 이후 tail repair, beam, block을 한 번에 하나씩 추가해 ablation 결과가 개선될 때만 유지한다.
5. 알고리즘 정책에는 엔진 버전, seed, 시간/반복 예산, 목적 우선순위, 미검증 안전 항목을 공개한다.

## 출처 부록

- Gonçalves & Resende, BRKGA/maximal-space decoder: https://doi.org/10.1016/j.cor.2011.03.009
- Ren·Tian·Sawaragi, tree search/block-building: https://doi.org/10.1016/j.ejor.2011.04.025
- Moura & Oliveira, GRASP/stability: http://hdl.handle.net/10198/8560
- Nascimento et al., 12 practical constraints/exact model: https://doi.org/10.1016/j.cor.2020.105186
- Ramos et al., load balance: https://doi.org/10.1016/j.ejor.2017.10.050
- Ramos et al., static mechanical equilibrium: https://doi.org/10.1080/0305215X.2020.1779250
- Bonet Filella et al., multi-drop/rehandling: https://doi.org/10.1016/j.ejor.2022.10.033
- Q4RealBPP realistic benchmark: https://data.mendeley.com/datasets/y258s6d939
- PackLib²: https://www.ibr.cs.tu-bs.de/alg/packlib/instances.shtml

---

조사 스냅샷은 2026-08-13 기준이다. 논문상 우수성과 LoadWise에서의 실제 개선은 동일하지 않으며, 모든 채택 결정은 동일 제약·동일 시간 예산의 회귀 benchmark 결과로 내려야 한다.

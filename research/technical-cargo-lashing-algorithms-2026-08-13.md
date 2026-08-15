---
topic: "Cargo lashing theory and algorithms for LoadWise"
type: "technical"
goals: "Identify defensible cargo-securing theory, calculation inputs, open implementations, and a safe integration path for LoadWise"
date: "2026-08-13"
methodology: "Parallel web research. Official regulations and standards are prioritized; GitHub projects are evaluated separately for code quality and licensing. Citations include confidence levels."
---

# 화물 래싱 이론·알고리즘 조사 보고서

> **가정:** 도로·해상 컨테이너 운송을 중심으로 조사하며, LoadWise는 안전 인증 도구가 아니라 작업 검토용 베타로 유지한다.
>
> **목표:** 적용 가능한 계산 모델, 필수 입력값, 규정 차이, 공개 구현 사례와 단계별 도입안을 찾는다.

## 공식 규정과 표준

가장 직접적인 공개 근거는 IMO·ILO·UNECE가 공동 제정한 CTU Code다. CTU Code는 도로 운송에서 전방 0.8g, 후방과 좌우 0.5g을 사용하며, 해상은 해역 조건에 따라 별도 계수를 적용한다. 기본 외력은 `F = m × g × c`이고, 미끄럼과 전도는 방향별로 따로 검증한다. [UNECE CTU Code](https://unece.org/transport/documents/standards/ctu-code) (accessed 2026-08-13, Primary, confidence: High) [FMCSA Cargo Securement Rules](https://www.fmcsa.dot.gov/regulations/cargo-securement/cargo-securement-rules) (accessed 2026-08-13, Primary, confidence: High)

여기서 규정의 `50%`는 화물 면의 접촉률이 아니라 후방·횡방향으로 견뎌야 하는 **화물 중량 대비 관성력**이다. 따라서 LoadWise의 전후좌우 50% 접촉 판정은 규정식이 아니라 기하학적 위험 선별 규칙으로만 사용해야 한다. [EU Directive 2014/47/EU Annex III](https://www.legislation.gov.uk/eudr/2014/47/pdfs/eudr_20140047_2014-05-19_en.pdf) (accessed 2026-08-13, Primary, confidence: High) [DVSA load securing basics](https://www.gov.uk/guidance/securing-loads-on-hgvs-and-goods-vehicles/2-load-securing-the-basics) (accessed 2026-08-13, Primary, confidence: High)

EN 12195-1:2010은 도로 차량의 블로킹·래싱·조합 고정력, 미끄럼과 전도를 다루지만 상세 공식과 표는 유료 표준이다. 정식 원문 없이 `EN 12195-1 준수`를 주장해서는 안 된다. 공개 구현의 1차 기준은 CTU Code로 삼고, EN 모드는 표준을 확보한 뒤 별도 검증하는 편이 안전하다. [BSI EN 12195-1](https://knowledge.bsigroup.com/products/load-restraining-on-road-vehicles-safety-calculation-of-securing-forces) (accessed 2026-08-13, Primary, confidence: Medium)

해상 운송은 IMO CSS Code와 선박별 Cargo Securing Manual을 함께 고려해야 한다. CSS Code는 예상되는 가장 가혹한 기상조건과 적격자의 계획·감독을 요구하므로 웹 계산기가 선장이나 현장 전문가의 결정을 대체할 수 없다. [IMO CSS Code](https://www.imo.org/en/ourwork/safety/pages/css-code.aspx) (accessed 2026-08-13, Primary, confidence: High)

## 물리 모델과 계산식

슬라이딩 수요의 기본형은 `F_required = max(0, m·g·(c_horizontal − μ·c_vertical) − F_blocking)`이다. 마찰계수 `μ`가 검증되지 않았다면 DVSA는 도로 운송 계산에 0.2를 쓰도록 안내하며, 고마찰 매트도 단독 고정수단으로 의존해서는 안 된다고 설명한다. [CTU Code Appendix 4](https://wiki.unece.org/spaces/TransportSustainableCTUCode/pages/23102061/Appendix%2B4.%2BSpecific%2Bpacking%2Band%2Bsecuring%2Bcalculations) (accessed 2026-08-13, Primary, confidence: High) [DVSA securing methods](https://www.gov.uk/guidance/securing-loads-on-hgvs-and-goods-vehicles/4-ways-to-secure-a-load-in-an-hgv-or-goods-vehicle) (accessed 2026-08-13, Primary, confidence: High)

Top-over와 direct lashing은 계산 변수가 다르다. Top-over는 래칫의 표준 장력 `STF`, 마찰계수와 수직각으로 추가 정상력과 마찰을 만든다. Direct lashing은 밴드의 `LC/MSL`과 수평·수직 방향 성분을 사용한다. DVSA는 top-over 각도가 바닥 기준 30° 미만이면 효과적인 마찰식 래싱으로 보지 않으며, CTU Code는 중량 화물의 미끄럼 방지에 top-over만 의존하지 말고 half-loop, spring/direct lashing 또는 blocking을 검토하도록 안내한다. [DVSA securing methods](https://www.gov.uk/guidance/securing-loads-on-hgvs-and-goods-vehicles/4-ways-to-secure-a-load-in-an-hgv-or-goods-vehicle) (accessed 2026-08-13, Primary, confidence: High) [CTU Code cargo securing](https://wiki.unece.org/spaces/TransportSustainableCTUCode/pages/23102048/4%2BSecuring%2Bof%2Bcargo%2Bin%2BCTUs?src=sidebar) (accessed 2026-08-13, Primary, confidence: High)

전도는 슬라이딩과 별도로 `전도 모멘트 = m·g·c_horizontal·h_CG`, `복원 모멘트 = m·g·c_vertical·b_CG + blocking moment + lashing moment`의 구조로 네 방향을 검증해야 한다. 따라서 질량, 실제 무게중심, 지지면 가장자리, 밴드 경로와 앵커 좌표가 없으면 안전 판정이나 필요 밴드 수량을 확정할 수 없다. [IMO Annex 13 equations](https://www.imorules.com/GUID-5947F2FD-7686-4C9B-9147-2CE62B119A48.html) (accessed 2026-08-13, Established mirror of IMO text, confidence: Medium) [IMO CSS Code](https://www.imo.org/en/ourwork/safety/pages/css-code.aspx) (accessed 2026-08-13, Primary, confidence: High)

컨테이너 벽과 앵커도 무한 강성이 아니다. CTU Code는 일반 하부 래싱 포인트를 최소 10 kN MSL, 일부 최신 포인트를 20 kN, 상부 사이드레일 포인트를 최소 5 kN으로 설명하지만 실제 제작사 값을 확인해야 한다. 계산에 쓸 수 있는 힘은 밴드, 앵커, 화물 고정점 중 가장 낮은 허용력으로 제한해야 한다. [CTU Code freight containers](https://wiki.unece.org/spaces/TransportSustainableCTUCode/pages/23101913/6.2%2BFreight%2Bcontainers) (accessed 2026-08-13, Primary, confidence: Medium)

## 공개 구현과 GitHub 사례

공개 GitHub에서 직접 관련된 구현은 [karobolas-cmyk/lashing-calculator](https://github.com/karobolas-cmyk/lashing-calculator) 하나가 확인됐다. Node.js/Vanilla JS로 top-over와 direct/diagonal lashing, LC/STF, 마찰, 미끄럼과 전도를 다룬다. 그러나 2026년 6월 생성된 소규모 단일 기여자 저장소이고 테스트와 CI가 없으며, README의 EN 12195-1 준수 주장을 독립 검증할 자료도 없다. LICENSE 파일은 MIT를 표시하지만 package.json은 ISC여서 라이선스 메타데이터도 불일치한다. UI와 입력 구조는 참고할 수 있으나 공식과 계수를 복사하는 것은 권하지 않는다. (accessed 2026-08-13, Low-tier individual repository, confidence: Low for calculation correctness)

비교 가능한 상용 제품으로는 EN 12195-1 기반 미끄럼·전도·앵커 배치를 제공한다고 설명하는 [HeavyLash](https://heavygoods.net/en/apps/cargo-lashing), CSS/CTU Code 계산과 PDF를 제공하는 [MariLash](https://en.mariterm.se/cargo-securing/marilash/), 선박 컨테이너 스택 래싱을 다루는 [DNV StowLash3D](https://www.dnv.us/services/stowlash3d-48523/)가 있다. 이들은 기능 범위를 비교하는 데 유용하지만 공개 페이지의 공급사 주장만으로 계산 정확성을 검증할 수는 없다. (accessed 2026-08-13, Commercial/Classification sources, confidence: Medium)

결론적으로 재사용할 만한 성숙한 오픈소스 라이브러리는 찾지 못했다. UNECE 공개 예제로 순수 계산 모듈을 자체 구현하고, 골든 테스트를 만든 뒤 상용 계산기 결과와 참고 비교하는 방식이 가장 방어 가능하다. [UNECE CTU Code calculation examples](https://wiki.unece.org/spaces/TransportSustainableCTUCode/pages/23102061/Appendix%2B4.%2BSpecific%2Bpacking%2Band%2Bsecuring%2Bcalculations) (accessed 2026-08-13, Primary, confidence: High)

## LoadWise 적용 설계

1단계에서는 현재 기하 로직을 `고정 필요성 선별`로만 유지한다. 출력 용어는 `밴드 필수`가 아니라 `고정력 계산 필요`, 3D 그래픽은 `예시 경로`가 적절하다.

2단계로 운송 프로파일(도로, 철도, 해상 A/B/C, 복합운송), 화물 질량·실제 CoG, 마찰계수, 고정 방식, 밴드 LC/STF, 앵커 좌표·MSL을 입력받는다. 하나라도 없으면 수량을 확정하지 않고 `정보 부족/현장 계산 필요`를 표시한다.

3단계 계산 모듈은 전·후·좌·우별 관성력, 마찰·블로킹 저항, 잔여 미끄럼 수요, 전도/복원 모멘트와 밴드·앵커 이용률을 반환해야 한다. Top-over와 direct/loop/spring을 서로 다른 공식으로 분리하고, 원통은 초크·크래들을 먼저 검토한다.

4단계 결과 등급은 `계산상 충족`, `조건부`, `불충족`, `배치 재검토`, `전문가 검증 필요`로 구분한다. `충족`은 입력된 밴드와 앵커의 방향별 이용률이 모두 100% 이하인 경우에만 사용한다.

## 핵심 결론

가장 중요한 발견은 LoadWise의 현재 50% 접촉 규칙이 실제 래싱 규정과 다른 개념이라는 점이다. 현 로직은 위험 화물을 빠르게 찾는 데는 유용하지만 밴드 방식·개수·안전성을 결정할 수 없다.

다음 개발 우선순위는 3D 밴드를 더 정교하게 그리는 것이 아니라 `CTU Code 기반 고정력 검토 모듈`을 별도 순수 함수로 만드는 것이다. 정식 EN 12195-1을 확보하기 전에는 CTU Code 기반 참고 계산으로 명시해야 한다.

공개 GitHub 코드는 참고 수준에 머물며 그대로 채택할 대상은 없다. 공식 공개 예제와 LoadWise 자체 테스트를 기준으로 구현하는 것이 안전성과 유지보수 양쪽에서 낫다.

## 위험과 불확실성

EN 12195-1과 IMO CSS Code의 일부 상세 계산은 유료 원문이므로, 공개 자료만으로 법규 준수 계산을 완성했다고 주장할 수 없다. 마찰계수, 화물 CoG, 포장 강도, 실제 앵커 MSL과 밴드 각도가 현장 값과 다르면 계산 결과도 무효가 된다. 또한 국가·운송모드별 규정이 다르므로 미국 FMCSA, 유럽 EN, 해상 CSS/CTU 판정을 하나의 공통 `안전 인증`으로 합쳐서는 안 된다.

> 이 조사는 2026-08-13 기준 공개 자료의 스냅샷이며, 법률·구조 안전 자문을 대신하지 않는다.

import {test,expect} from '@playwright/test';

test('algorithm policy opens inside the app',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'알고리즘 정책'}).click();
  await expect(page.getByRole('heading',{name:'알고리즘 정책과 한계'})).toBeVisible();
  await expect(page.locator('#policyDialog')).toHaveAttribute('open','');
});

test('user guide opens inside the app',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'사용 가이드'}).click();
  await expect(page.locator('#guideDialog')).toHaveAttribute('open','');
  await expect(page.getByRole('heading',{name:'LoadWise 사용 가이드'})).toBeVisible();
});

test('validation warning uses the in-app notice dialog',async({page})=>{
  await page.goto('/');
  await page.locator('#productName').fill('');
  await page.locator('#addProduct').click();
  await expect(page.locator('#messageDialog')).toHaveAttribute('open','');
  await expect(page.getByRole('heading',{name:'제품 정보를 확인해 주세요'})).toBeVisible();
});

test('admin controls stay hidden before login',async({page})=>{
  await page.goto('/');
  await expect(page.locator('#adminButton')).toBeHidden();
});

test('login offers social, email and guest options',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'로그인'}).click();
  await expect(page.getByRole('button',{name:'Google로 계속하기'})).toBeVisible();
  await expect(page.locator('#microsoftLogin')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'인증번호 받기'})).toBeVisible();
  await expect(page.locator('#emailOtp')).toBeHidden();
  await expect(page.locator('.guest-save-note')).toContainText('현재 브라우저');
});

test('beta safety notice stays in the project toolbar',async({page})=>{
  await page.goto('/');
  await expect(page.locator('.project-toolbar .safety-notice')).toContainText('작업 검토용 베타');
  await expect(page.locator('.result-panel .safety-notice')).toHaveCount(0);
});

test('metrics follow the 3D view and dense sections collapse',async({page})=>{
  await page.goto('/');
  await expect(page.locator('#simulate')).toHaveCount(0);
  await expect(page.locator('.control-panel #containerType')).toHaveCount(0);
  await expect(page.locator('.simulation-config-bar #containerType')).toBeVisible();
  await expect(page.locator('.simulation-config-bar #recalculateOptions')).toBeVisible();
  await expect(page.locator('#canvasWrap + #stats')).toHaveCount(1);
  await expect(page.locator('#balanceCard + .loading-plan')).toHaveCount(1);
  await expect(page.locator('.loading-plan + #securingPanel')).toHaveCount(1);
  await expect(page.locator('.loading-plan')).toHaveCSS('border-top-style','solid');
  for(const control of ['#toggleProducts','#securingPanel .collapse-state','#toggleSequence']){await expect(page.locator(control)).toHaveCSS('border-radius','999px');await expect(page.locator(control)).toHaveCSS('min-height','34px')}
  await page.getByRole('button',{name:'샘플 불러오기'}).click();
  const products=page.locator('.product-list-card');await expect(products).toHaveClass(/expanded/);await expect(page.locator('#toggleProducts')).toHaveText('접기 ▴');await expect(page.locator('#productList')).toHaveCSS('overflow-y','visible');await page.locator('#toggleProducts').click();await expect(products).not.toHaveClass(/expanded/);await expect(page.locator('#toggleProducts')).toHaveText('펼치기 ▾');await expect(page.locator('#productList')).toHaveCSS('overflow-y','auto');
  await expect(page.locator('#toggleSequence')).toHaveText('펼치기 ▾');await page.locator('#toggleSequence').click();await expect(page.locator('.loading-plan')).toHaveClass(/expanded/);await expect(page.locator('#toggleSequence')).toHaveText('접기 ▴');
  const securing=page.locator('#securingPanel');await expect(securing).toHaveAttribute('open','');await securing.locator('summary').click();await expect(securing).not.toHaveAttribute('open','');
});

test('guest project saves, reloads, and recalculates automatically',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'샘플 불러오기'}).click();
  await expect(page.locator('#loadedCount')).toHaveText('36개');
  await page.getByRole('button',{name:'저장',exact:true}).click();
  await page.getByRole('textbox',{name:'저장 이름'}).fill('E2E 자동 계산');
  await page.getByRole('button',{name:'이 이름으로 저장'}).click();
  await expect(page.locator('#saveState')).toHaveText('브라우저 저장됨');
  await page.getByRole('button',{name:'저장',exact:true}).click();
  await expect(page.getByRole('heading',{name:'현재 프로젝트에 저장할까요?'})).toBeVisible();
  await page.getByRole('button',{name:'취소'}).click();
  await page.getByRole('button',{name:'새 프로젝트'}).click();
  await expect(page.locator('#loadedCount')).toHaveText('—');
  await page.getByRole('button',{name:'저장 목록'}).click();
  await page.locator('[data-open]').filter({hasText:'E2E 자동 계산'}).click();
  await expect(page.locator('#loadedCount')).toHaveText('36개');
  await expect(page.locator('#simulationStatus')).toContainText('적재 완료');
});

test('weight balance, view presets and printable work instruction work together',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'샘플 불러오기'}).click();await expect(page.locator('#balanceCard')).toBeVisible();await expect(page.locator('#frontRearBalance')).not.toHaveText('—');
  for(const name of ['문 기준','좌측면','우측면','상면','3D']){await page.getByRole('button',{name,exact:true}).click();await expect(page.getByRole('button',{name,exact:true})).toHaveClass(/active/)}
  await page.getByRole('button',{name:'우측면',exact:true}).click();await page.getByRole('button',{name:'보기 초기화'}).click();await expect(page.getByRole('button',{name:'3D',exact:true})).toHaveClass(/active/);
  await expect(page.locator('#fieldResultButton')).toHaveCount(0);const popupPromise=page.waitForEvent('popup');await page.locator('#exportPdf').click();const report=await popupPromise;await report.waitForLoadState();await expect(report.getByRole('button',{name:'인쇄 / PDF 저장'})).toBeVisible();await expect(report.getByText('현장 작업 기록')).toBeVisible();await expect(report.getByText('실제 적재 수량')).toBeVisible();
});

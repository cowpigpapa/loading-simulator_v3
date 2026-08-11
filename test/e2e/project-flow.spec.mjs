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

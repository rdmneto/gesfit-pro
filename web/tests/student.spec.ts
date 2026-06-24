import { test, expect } from '@playwright/test';

test.describe('Student Flow', () => {
  const uniqueEmail = `student_${Date.now()}@example.com`;
  const password = 'Password123!';

  test('should allow a student to navigate their panel and view sections', async ({ page }) => {
    // 1. Sign up as a student
    await page.goto('/login');
    await page.getByRole('button', { name: 'Criar conta' }).first().click();
    await page.getByPlaceholder('Seu nome').fill('Aluno Teste E2E');
    await page.getByPlaceholder('voce@email.com').fill(uniqueEmail);
    await page.getByPlaceholder('Mínimo 6 caracteres').fill(password);
    await page.getByPlaceholder('Repita a senha').fill(password);
    await page.locator('form').getByRole('button', { name: 'Criar conta' }).click();

    await expect(page).toHaveURL(/\/app\/onboarding/);
    await expect(page.getByText('Bem-vindo ao Gesfit Pro')).toBeVisible();

    await page.getByRole('button', { name: /Sou Aluno/i }).click();

    // Accept contract
    await page.getByRole('checkbox', { name: /Li e aceito/i }).check();
    await page.getByRole('button', { name: /Aceito/i }).click();

    // Fill minimal anamnesis
    await page.getByPlaceholder('+55 85 99999-9999').fill('11999999999');
    await page.locator('input[type="date"]').fill('2000-01-01');
    await page.getByPlaceholder('175').fill('175');
    await page.getByPlaceholder('78.5').fill('70');
    await page.getByRole('button', { name: /Concluir Meu Cadastro/i }).click();

    await expect(page).toHaveURL(/\/app/);

    // 2. Student Panel Verification
    // Assuming there is a sidebar or navigation with links
    await page.getByRole('link', { name: /Dashboard/i }).click();
    await expect(page.getByRole('heading', { name: /Bem-vindo/i })).toBeVisible();

    // Check "Avaliações"
    const avaliacoesLink = page.getByRole('link', { name: /Avaliações/i });
    if (await avaliacoesLink.isVisible()) {
      await avaliacoesLink.click();
      await expect(page.getByRole('heading', { name: /Avaliações/i })).toBeVisible();
    }

    // Check "Meu Perfil"
    const perfilLink = page.getByRole('link', { name: /Perfil/i });
    if (await perfilLink.isVisible()) {
      await perfilLink.click();
      await expect(page.getByRole('heading', { name: /Meu Perfil/i })).toBeVisible();
    }
  });
});

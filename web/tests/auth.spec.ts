import { test, expect } from '@playwright/test';

test.describe('Authentication and Onboarding Flow', () => {
  // Use a unique email for each test run to avoid "email already in use" errors 
  // since the emulator state persists across test runs unless wiped.
  const uniqueEmail = `testuser_${Date.now()}@example.com`;
  const password = 'Password123!';

  test('should allow a new user to sign up and reach the onboarding screen', async ({ page }) => {
    // 1. Navegar para a página inicial
    await page.goto('/');

    // Se houver botão de entrar na landing page, clica nele. Mas nossa landing page 
    // redireciona ou tem um botão "Entrar / Criar Conta".
    // Como a Home tem um botão que manda para /login:
    await page.goto('/login');

    // 2. Mudar para a aba de "Criar conta"
    await page.getByRole('button', { name: 'Criar conta' }).first().click();

    // 3. Preencher o formulário de cadastro
    await page.getByPlaceholder('Seu nome').fill('Usuário Teste E2E');
    await page.getByPlaceholder('voce@email.com').fill(uniqueEmail);
    await page.getByPlaceholder('Mínimo 6 caracteres').fill(password);
    await page.getByPlaceholder('Repita a senha').fill(password);

    // 4. Submeter o formulário
    await page.locator('form').getByRole('button', { name: 'Criar conta' }).click();

    // 5. Verificar se fomos redirecionados para o onboarding
    await expect(page).toHaveURL(/\/app\/onboarding/);

    // 6. Verificar se a tela de onboarding renderizou com a saudação
    await expect(page.getByText('Bem-vindo ao Gesfit Pro')).toBeVisible();

    // 7. Escolher o perfil de "Aluno"
    await page.getByRole('button', { name: /Sou Aluno/i }).click();

    // 8. Tela de Contrato: Marcar aceite
    await expect(page.getByRole('heading', { name: 'Contrato de Prestação de Serviços', exact: true })).toBeVisible();
    await page.getByRole('checkbox', { name: /Li e aceito/i }).check();
    await page.getByRole('button', { name: /Aceito/i }).click();

    // 9. Tela de Dados Físicos: Preencher campos obrigatórios
    await expect(page.getByText('Dados Físicos (Anamnese)')).toBeVisible();
    await page.getByPlaceholder('+55 85 99999-9999').fill('11999999999');
    
    // Select the city (just keep the default or select first)
    // The select doesn't have a placeholder, but it has a label "Cidade *"
    // Let's just fill the other inputs
    
    // Data de Nascimento
    // date input
    await page.locator('input[type="date"]').fill('2000-01-01');
    
    // Altura (cm)
    await page.getByPlaceholder('175').fill('175');
    
    // Peso Atual (kg)
    await page.getByPlaceholder('78.5').fill('70');

    // Submeter Anamnese
    await page.getByRole('button', { name: /Concluir Meu Cadastro/i }).click();

    // 10. Verificar se fomos para a área logada (o app redireciona com base na ausência de vínculo)
    await expect(page).toHaveURL(/\/app/);
  });
});

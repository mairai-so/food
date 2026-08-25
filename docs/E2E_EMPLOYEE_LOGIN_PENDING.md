# Pendencias do login de funcionario no E2E

O teste E2E do Garcom usa `POST /api/auth/employee-tokens` com a sessao do dono para gerar um token temporario do funcionario criado no onboarding. Isso evita a ambiguidade do login por PIN global quando varios restaurantes possuem funcionarios com o mesmo PIN.

Estas limitacoes continuam pendentes no produto e nao sao alteradas pelo teste:

- O Gestor ainda nao oferece uma UI completa para gerar e mostrar o token ou QR Code do funcionario.
- O app Garcom ainda nao consome automaticamente `?token=` na URL para iniciar a sessao.
- O login por PIN deve ser escopado por restaurante antes de producao; PINs iguais em restaurantes diferentes nao podem resultar em uma busca global ambigua.

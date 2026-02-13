# Storage Buckets Setup

## Opção 1: Executar via Supabase Dashboard (Recomendado)

1. Acesse o Supabase Dashboard: https://supabase.com/dashboard
2. Selecione seu projeto **circlehood-booking**
3. Vá em **SQL Editor** no menu lateral
4. Copie e cole o conteúdo do arquivo `supabase/migrations/20250213_storage_buckets.sql`
5. Clique em **Run** para executar

## Opção 2: Criar Buckets Manualmente

### Passo 1: Criar os Buckets

1. Acesse **Storage** no menu lateral do Supabase Dashboard
2. Clique em **New bucket**
3. Crie o bucket `avatars`:
   - Name: `avatars`
   - Public: ✅ Marcado
   - File size limit: 0.5 MB (524288 bytes)
   - Allowed MIME types: `image/jpeg, image/jpg, image/png, image/webp`
4. Repita para criar o bucket `covers` com as mesmas configurações

### Passo 2: Configurar Políticas RLS

Vá em **Storage** > **Policies** e adicione as seguintes políticas:

**Para o bucket `avatars`:**
- ✅ SELECT (Public read) - `bucket_id = 'avatars'`
- ✅ INSERT (Authenticated users) - `bucket_id = 'avatars' AND auth.uid() IS NOT NULL`
- ✅ UPDATE (Authenticated users) - `bucket_id = 'avatars' AND auth.uid() IS NOT NULL`
- ✅ DELETE (Authenticated users) - `bucket_id = 'avatars' AND auth.uid() IS NOT NULL`

**Para o bucket `covers`:**
- ✅ SELECT (Public read) - `bucket_id = 'covers'`
- ✅ INSERT (Authenticated users) - `bucket_id = 'covers' AND auth.uid() IS NOT NULL`
- ✅ UPDATE (Authenticated users) - `bucket_id = 'covers' AND auth.uid() IS NOT NULL`
- ✅ DELETE (Authenticated users) - `bucket_id = 'covers' AND auth.uid() IS NOT NULL`

## Verificação

Após executar a migração ou criar manualmente, verifique que:
1. Os buckets `avatars` e `covers` existem
2. Ambos estão marcados como públicos
3. As políticas RLS estão aplicadas
4. O limite de tamanho está em 0.5 MB

## Testando

1. Faça login na aplicação
2. Vá em **Minha Página**
3. Clique em "Upload" na foto de perfil ou capa
4. Selecione uma imagem
5. Aguarde o upload e compressão
6. A imagem deve aparecer imediatamente no preview

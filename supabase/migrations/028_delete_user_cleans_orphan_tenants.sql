-- ============================================================================
-- Migration 028 — Apagar usuário também apaga empresa que ficar órfã
--
-- Bug: delete_user_completely removia o usuário e seus vínculos, mas nunca
-- tocava em `tenants`. Se o usuário era o ÚNICO da empresa, a empresa ficava
-- órfã (sem nenhum membro) e continuava existindo.
--
-- Correção: captura as empresas do usuário ANTES de remover os vínculos e, no
-- fim, apaga as que ficaram SEM NENHUM membro. Todas as tabelas apontam pra
-- tenants com ON DELETE CASCADE, então apagar o tenant limpa todos os dados.
-- Empresas que ainda têm outros usuários são preservadas.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.delete_user_completely(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_tenant_ids uuid[];
BEGIN
  -- Só super admin pode deletar
  IF NOT EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Não pode deletar a si mesmo
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode deletar a si mesmo';
  END IF;

  -- Não pode deletar o master
  IF EXISTS (SELECT 1 FROM super_admins sa WHERE sa.user_id = p_user_id AND sa.type = 'master') THEN
    RAISE EXCEPTION 'Não é possível deletar o Super Admin Master';
  END IF;

  -- Empresas do usuário (antes de remover os vínculos)
  SELECT array_agg(tenant_id) INTO v_tenant_ids
  FROM user_memberships WHERE user_id = p_user_id;

  -- Limpa todas as referências
  UPDATE leads             SET assigned_to       = NULL WHERE assigned_to       = p_user_id;
  UPDATE pipeline_cards    SET moved_by          = NULL WHERE moved_by          = p_user_id;
  UPDATE user_memberships  SET status_changed_by = NULL WHERE status_changed_by = p_user_id;
  UPDATE goals             SET created_by        = NULL WHERE created_by        = p_user_id;

  DELETE FROM lead_activities  WHERE user_id    = p_user_id;
  DELETE FROM goals            WHERE user_id    = p_user_id;
  DELETE FROM tenant_invites   WHERE created_by = p_user_id;
  DELETE FROM signup_tokens    WHERE created_by = p_user_id OR used_by = p_user_id;
  DELETE FROM super_admins     WHERE user_id    = p_user_id;
  DELETE FROM user_memberships WHERE user_id    = p_user_id;
  DELETE FROM profiles         WHERE id         = p_user_id;
  DELETE FROM auth.users       WHERE id         = p_user_id;

  -- Apaga as empresas que ficaram SEM NENHUM membro (cascade limpa os dados).
  -- Empresas com outros usuários são preservadas.
  IF v_tenant_ids IS NOT NULL THEN
    DELETE FROM tenants t
    WHERE t.id = ANY(v_tenant_ids)
      AND NOT EXISTS (SELECT 1 FROM user_memberships um WHERE um.tenant_id = t.id);
  END IF;
END;
$function$;

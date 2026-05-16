-- ============================================================================
-- Manager Permissions — Bloqueio no banco
-- Manager pode convidar/criar APENAS role='seller'.
-- Seller não pode convidar/criar ninguém.
-- Admin e Super Admin podem qualquer role.
-- ============================================================================

-- 1. Trigger: valida role ao CRIAR convite em tenant_invites
CREATE OR REPLACE FUNCTION validate_invite_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_my_role text;
BEGIN
  -- Super admin bypassa (pode tudo)
  IF EXISTS (SELECT 1 FROM super_admins sa WHERE sa.user_id = auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Descobre o role do usuário logado neste tenant
  SELECT m.role INTO v_my_role
  FROM user_memberships m
  WHERE m.user_id = auth.uid()
    AND m.tenant_id = NEW.tenant_id
    AND m.active = true
  LIMIT 1;

  IF v_my_role IS NULL THEN
    RAISE EXCEPTION 'Você não tem permissão para convidar usuários neste tenant';
  END IF;

  -- Manager → só seller
  IF v_my_role = 'manager' AND NEW.role::text != 'seller' THEN
    RAISE EXCEPTION 'Gestores podem convidar apenas Vendedores';
  END IF;

  -- Seller → ninguém
  IF v_my_role = 'seller' THEN
    RAISE EXCEPTION 'Vendedores não podem convidar usuários';
  END IF;

  -- Admin → manager e seller (não pode criar admin)
  IF v_my_role = 'admin' AND NEW.role::text = 'admin' THEN
    RAISE EXCEPTION 'Apenas Super Admin pode criar outros Admins';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_invite_role ON tenant_invites;
CREATE TRIGGER trg_validate_invite_role
BEFORE INSERT ON tenant_invites
FOR EACH ROW EXECUTE FUNCTION validate_invite_role();

-- 2. Trigger: valida role ao ATUALIZAR membership (mudança de role)
CREATE OR REPLACE FUNCTION validate_membership_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_my_role text;
BEGIN
  -- Se a role não mudou, ok
  IF OLD.role = NEW.role THEN
    RETURN NEW;
  END IF;

  -- Super admin bypassa
  IF EXISTS (SELECT 1 FROM super_admins sa WHERE sa.user_id = auth.uid()) THEN
    RETURN NEW;
  END IF;

  SELECT m.role INTO v_my_role
  FROM user_memberships m
  WHERE m.user_id = auth.uid()
    AND m.tenant_id = NEW.tenant_id
    AND m.active = true
  LIMIT 1;

  IF v_my_role IS NULL THEN
    RAISE EXCEPTION 'Sem permissão para alterar roles';
  END IF;

  -- Manager → só pode mexer em seller (não tocar em manager/admin)
  IF v_my_role = 'manager' THEN
    IF OLD.role::text != 'seller' OR NEW.role::text != 'seller' THEN
      RAISE EXCEPTION 'Gestores podem alterar apenas papéis de Vendedores e manter como Vendedor';
    END IF;
  END IF;

  -- Seller → não pode alterar nada
  IF v_my_role = 'seller' THEN
    RAISE EXCEPTION 'Vendedores não podem alterar papéis';
  END IF;

  -- Admin → não pode promover ninguém para admin
  IF v_my_role = 'admin' AND NEW.role::text = 'admin' THEN
    RAISE EXCEPTION 'Apenas Super Admin pode promover usuários para Admin';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_membership_role_change ON user_memberships;
CREATE TRIGGER trg_validate_membership_role_change
BEFORE UPDATE OF role ON user_memberships
FOR EACH ROW EXECUTE FUNCTION validate_membership_role_change();

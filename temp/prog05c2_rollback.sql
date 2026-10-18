-- TMS-FIN-PROG-05C.2 — ROLLBACK (restaura estado anterior)
BEGIN;
UPDATE public.financeiro_receber SET is_teste = false
 WHERE id IN ('bb828a6b-e6c2-4bc0-bdbb-6654fb3ba734','cf6eea7b-4c9d-4200-b306-4d209764112f','b0fc497a-f201-4218-a62b-b5fa3e005fc5','29e0b127-5d02-4631-9029-da162e87d9d7','3665c595-02bb-41d4-963f-903cbbd1a540','95b25c22-819f-4fe0-8058-e1b395fd2f5b','ac68bec4-6124-48a5-b73c-c17fe89164ca','ad02ce1a-73b8-4909-b75d-b073da7b9b0c','2f910daf-ac2c-44e6-b81b-0aa503b0681f','e1b8f9a8-66c2-4bf2-b5bb-210048ebe375','3bd62acd-2287-4f86-b1d0-977c5641cfc8','e0c5355c-b1be-4de4-a87e-a52cd9fd9d96','2bd14450-7a8b-4309-acec-21bc07222b6f','4ddcf297-752b-4247-bda3-945fd6a83439','ecae95e6-6570-48be-bb16-fdb858f3d0b2','22c7b93a-2437-4883-b199-4335047ffdd3','550b36cb-ab41-4440-a60d-03c108a87376','57b454fc-81f3-424c-a035-0a00ddf86393','3c019285-a60d-485e-b290-33b2afd5b1c9','ff54e4e2-cdcd-44bb-af70-fa06755341f8','06211e9b-05d8-4032-9d56-f7c3b0c6f8c7','1ae4d758-7e38-4f7f-9680-1c9069e14108','697e61df-a6ee-47ea-8163-acff1c415551','90abcc23-1764-4242-a1dd-8235e9c49a37','f86b1328-cbde-4259-811e-323a7fc1d021','59278800-8d94-4617-bd16-6429efafce9f','4b983f52-fbee-42f7-a40f-84d8bc2d4cfb','cb5f6a6a-cee4-4559-b900-61341fad67e9','e72afe9e-fb9a-4adb-ae61-b33af8821f24','adab036f-c56e-4884-812f-d23034766075','76dc2c4f-173f-4212-9def-5ece6be7c49f','210ff86b-1248-47f1-bad2-89041581d049','9bcd5a33-8190-4d48-bd99-67eda97a0060','f66f8273-380b-4a4b-b8db-507c8cb3baa1','2a35cf05-00f8-435f-aae9-9bc5ce6213b5','6104648d-b23e-4e28-9d0d-722118979715','b427ee36-fe30-432d-aaaf-8d50711a55cd','ada1b009-8502-4fb6-883d-8f3ce3c057ad','07717add-7854-4b56-ae6a-f0d3c798231d','36a638b2-756a-459a-b203-fba3bb766268','df804677-5b7a-459e-9013-959c709c21f8','75e0e5f0-c512-49b6-9542-716362705c08','9f3a6a6c-e5d2-4313-99cd-90389d7edecc','d4c9e73c-b1f9-4627-9174-d44f21140ad1','16609f03-a692-4610-85ad-4b0a5b74c9bc','c3998227-6b5e-48ae-8bf1-0f1049c8c01f','f08536e7-392e-474b-a103-11f6f9363cad','7e283ebd-26c8-43e0-8fdc-0f73bf35084f','1dcc9b2a-4f2c-4a35-8ced-9faee8bf9343','b4b4f199-f5ae-4c3d-8911-a3b1db2ec04c','e2571717-19ed-4a9b-ac00-aa1907729974','b9f73a07-3e1f-459a-8aa5-d607f30258df','ce77c326-e807-486b-993c-11823510aa14','32d901db-620c-4b62-bffa-44e76d63f9da','078f0821-5d05-41b5-9ca6-5f931218ef2d','c5941bca-ea3b-439e-8547-a319fc883b43');
UPDATE public.financeiro_receber SET is_teste = true
 WHERE id IN ('fb30838a-fc5f-430f-9aa3-9b7892e564d4','f75f6e71-d7ee-4d41-bb5e-6c9546409634','dc56791e-e46d-4544-85c0-822af5429c2f','02b5bf02-b708-4dbd-b9c7-44d57120bb11','6b935367-02db-4742-ba72-38c31430b6a0','4a305e2f-1b39-4f84-b3a6-73e90384f8dc','8fa86342-7258-4644-ac80-99effc7cfb42','9470b2ae-dd89-426d-82e7-c748fb9e032c','200ecb02-c91e-48e1-9dc8-ff73f99e0227','15d1b0d0-3bc9-4b74-8dc8-de094fa67cf4','7d51d307-b721-4bc7-8cd5-f78c86e22cbb','b708aee7-e4a2-46fa-b7b2-6235e713b966','89dc89e7-a7af-4e5b-a792-2be2d55cac2b','b2b51282-356b-4801-a1c7-90c13a4d4053','89600201-76ad-4689-809c-abc917812bf6','5a1ecd9e-15af-425a-b499-cfef5c17e172','fda53bb5-913b-4775-a8a1-be9e197956d2','218a9e47-047d-420b-b2b6-7ac84d49205d','e1e05ee4-7f6a-4a4a-b55b-4acceca2b050','d9c81573-62fa-492d-9a11-92b4d3eea083','2ec7e1f2-96aa-4173-9fd1-91fd5d5686c4');
UPDATE public.financeiro_receber SET status = 'aberto', observacoes = NULL
 WHERE id = '75e0e5f0-c512-49b6-9542-716362705c08';

CREATE OR REPLACE FUNCTION public.f_trg_fatura_itens_anti_duplicidade()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_os_ja_faturada uuid;
  v_status_fatura text;
BEGIN
  IF NEW.os_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT status INTO v_status_fatura FROM public.faturas WHERE id = NEW.fatura_id;

  -- Regra: mesmo serviço ativo não pode estar em duas faturas válidas
  -- (válidas = não canceladas). Fatura cancelada libera o serviço.
  IF v_status_fatura IS DISTINCT FROM 'cancelada' THEN
    SELECT fi.id INTO v_os_ja_faturada
    FROM public.fatura_itens fi
    JOIN public.faturas f ON f.id = fi.fatura_id
    WHERE fi.os_id = NEW.os_id
      AND fi.status = 'ativo'
      AND f.status IS DISTINCT FROM 'cancelada'
      AND fi.fatura_id IS DISTINCT FROM NEW.fatura_id
    LIMIT 1;

    IF v_os_ja_faturada IS NOT NULL THEN
      RAISE EXCEPTION 'SERVIÇO_JA_FATURADO: A OS % já está vinculada a outra fatura ativa.', NEW.os_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$
;
COMMIT;

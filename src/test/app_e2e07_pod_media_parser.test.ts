import { describe, it, expect } from "vitest";
import { parseStorageRef, POD_MEDIA_TTL_SECONDS } from "@/services/comprovantes/podMediaService";

/**
 * APP-E2E-07 — F3: parser de referência de mídia POD.
 * Distingue bucket privado (driver-evidence), público/legado e URL externa.
 */
describe("podMediaService.parseStorageRef", () => {
  it("A) extrai path de URL pública do bucket privado driver-evidence", () => {
    const r = parseStorageRef(
      "https://x.supabase.co/storage/v1/object/public/driver-evidence/uid/pod/aloc/2026/09/26/f.png"
    );
    expect(r).not.toBeNull();
    expect(r!.bucket).toBe("driver-evidence");
    expect(r!.path).toBe("uid/pod/aloc/2026/09/26/f.png");
    expect(r!.external).toBe(false);
  });

  it("B) mantém bucket público/legado (comprovantes-entrega)", () => {
    const r = parseStorageRef(
      "https://x.supabase.co/storage/v1/object/public/comprovantes-entrega/pod/op/f.png"
    );
    expect(r!.bucket).toBe("comprovantes-entrega");
    expect(r!.path).toBe("pod/op/f.png");
  });

  it("C) extrai path de URL assinada (sign) sem query", () => {
    const r = parseStorageRef(
      "https://x.supabase.co/storage/v1/object/sign/driver-evidence/uid/pod/aloc/f.png?token=abc"
    );
    expect(r!.bucket).toBe("driver-evidence");
    expect(r!.path).toBe("uid/pod/aloc/f.png");
  });

  it("D/E) caminho de objeto sem bucket → driver-evidence", () => {
    const r = parseStorageRef("399796b7-4e3b-432f-8744-4eb91f0ee31d/pod/e3/2026/09/26/f.png");
    expect(r!.bucket).toBe("driver-evidence");
    expect(r!.path).toBe("399796b7-4e3b-432f-8744-4eb91f0ee31d/pod/e3/2026/09/26/f.png");
  });

  it("F) URL externa arbitrária não é tratada como Storage", () => {
    const r = parseStorageRef("https://storage.example.com/foto_test_108c1.jpg");
    expect(r!.external).toBe(true);
  });

  it("G) caminho local de dispositivo é inválido (null)", () => {
    expect(parseStorageRef("/data/user/0/app/cache/scaled_x")).toBeNull();
    expect(parseStorageRef("C:\\tmp\\foto.jpg")).toBeNull();
    expect(parseStorageRef("")).toBeNull();
    expect(parseStorageRef(null)).toBeNull();
  });

  it("H) TTL curto padrão de 600s", () => {
    expect(POD_MEDIA_TTL_SECONDS).toBe(600);
  });
});

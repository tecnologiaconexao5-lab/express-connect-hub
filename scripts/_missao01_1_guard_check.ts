import "dotenv/config";
import { detectarAmbiente, verificarAmbiente } from "../tests/e2e/helpers/ambiente.ts";
console.log("AMBIENTE_DETECTADO=" + JSON.stringify(detectarAmbiente()));
try {
  verificarAmbiente();
  console.log("GUARD=PERMITIU");
} catch (e) {
  console.log("GUARD=BLOQUEOU");
  console.log(String((e as Error).message).replace(/\r/g, ""));
}

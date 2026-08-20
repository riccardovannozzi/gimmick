// ⚠️ PRIMO IMPORT, e deve restarlo. Inizializza Sentry prima che expo-router
// carichi il componente radice: gli import sono valutati prima di ogni
// istruzione, quindi questo è l'unico punto in cui arriva davvero per primo.
// Dettagli in `lib/sentry.ts`.
import "./lib/sentry";
import "./global.css";
import "expo-router/entry";

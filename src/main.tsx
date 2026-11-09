import { loadLanguage } from "./i18n/i18n";

// The language's dictionary first: screens build some of their texts as
// soon as their modules load.
void loadLanguage().then(() => import("./boot"));

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.liveChallengePushCopy = liveChallengePushCopy;
/** Notification copy matches the translated multiplayer invitation UI in every supported locale. */
const COPY = {
    "fr": {
        "title": "{name} vous défie",
        "body": "Accepter le défi"
    },
    "ja": {
        "title": "{name}からの挑戦",
        "body": "挑戦を受ける"
    },
    "de": {
        "title": "{name} fordert dich heraus",
        "body": "Herausforderung annehmen"
    },
    "pl": {
        "title": "{name} rzuca ci wyzwanie",
        "body": "Przyjmij wyzwanie"
    },
    "ko": {
        "title": "{name}님의 도전",
        "body": "도전 수락"
    },
    "nl": {
        "title": "{name} daagt je uit",
        "body": "Uitdaging aannemen"
    },
    "tr": {
        "title": "{name} sana meydan okudu",
        "body": "Meydan okumayı kabul et"
    },
    "pt": {
        "title": "{name} desafiou você",
        "body": "Aceitar desafio"
    },
    "vi": {
        "title": "{name} thách đấu bạn",
        "body": "Nhận thách đấu"
    },
    "id": {
        "title": "{name} menantangmu",
        "body": "Terima tantangan"
    },
    "es": {
        "title": "{name} te ha retado",
        "body": "Aceptar reto"
    },
    "ru": {
        "title": "{name} бросает вам вызов",
        "body": "Принять вызов"
    },
    "it": {
        "title": "{name} ti ha sfidato",
        "body": "Accetta la sfida"
    },
    "hi": {
        "title": "{name} ने चुनौती दी",
        "body": "चुनौती स्वीकार करें"
    },
    "en": {
        "title": "{name} challenged you",
        "body": "Accept challenge"
    },
    "ar": {
        "title": "تحداك {name}",
        "body": "قبول التحدي"
    }
};
/** Resolves recipient-language push copy with a safe English fallback. */
function liveChallengePushCopy(locale, name) {
    /** Only a supported locale can choose notification content. */
    const copy = typeof locale === "string" && COPY[locale] ? COPY[locale] : COPY.en;
    return { title: copy.title.replace("{name}", name), body: copy.body };
}
//# sourceMappingURL=raceLivePushCopy.js.map
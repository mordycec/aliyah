# Aliyah

A card game for two. Five roads lead up to Jerusalem, Tzfat, Tiberias, Hebron and Be'er Sheva, and every card you play on a road has to be higher than the one before it.

Play on two phones (each phone shows only its own hand) or pass one phone back and forth.

## Put it on your home screen

- **iPhone:** open the game link in Safari, tap the Share button, then **Add to Home Screen**.
- **Android:** open the link in Chrome, tap the menu, then **Install app** (or **Add to Home screen**).

## Play on two phones

1. One player taps **Start a game on two phones**. A 4-letter code appears.
2. The other player taps **Join with a code** and types it in.
3. The cards are dealt on both phones. Take turns; each move shows up on the other phone right away.

If a phone locks or loses signal, open the app again and it reconnects and catches up on its own. Leaving the game ends it on both phones.

## How it works

- `index.html`, `style.css`, `game.js` (rules and the two-phone connection) and `ui.js` (screens and taps) are the whole game.
- Two-phone play connects the phones directly using [PeerJS](https://peerjs.com) (MIT licensed, loaded from jsDelivr) and its free public connection server. No accounts and no game data stored on a server.
- `manifest.webmanifest`, `sw.js` and `icons/` make it installable. When you change a file, bump `CACHE` in `sw.js` so phones load the new version.

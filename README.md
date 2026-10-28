# LEVEL UP — prima versione

App personale per abitudini e missioni, con livelli, XP, achievement, statistiche e backup. Realizzata con HTML, CSS e JavaScript senza framework e senza backend. I dati sono salvati sul dispositivo tramite IndexedDB (con fallback a localStorage).

## Contenuto

- `index.html` — struttura dell'app
- `style.css` — interfaccia responsive
- `app.js` — missioni, XP, livelli, badge, grafici e backup
- `database.js` — persistenza locale
- `manifest.json` — configurazione PWA
- `service-worker.js` — cache offline
- `icons/` — icone PWA

## Avvio rapido su PC

Per la modalità PWA, service worker e notifiche, l'app va servita da `https://` oppure da `localhost`. Aprire `index.html` direttamente con doppio clic (`file://`) consente una prova parziale, ma non abilita tutte le funzioni PWA.

Se hai Python installato:
1. Estrai lo ZIP in una cartella.
2. Apri un terminale dentro `LEVEL-UP`.
3. Esegui `python -m http.server 8000`.
4. Apri `http://localhost:8000`.

## Installazione su Android

Il metodo più semplice è pubblicare la cartella su un hosting statico HTTPS, ad esempio GitHub Pages o Netlify:
1. Crea un repository GitHub e carica tutti i file mantenendo la struttura delle cartelle.
2. In GitHub vai in **Settings → Pages**, scegli il deploy dal branch principale e salva.
3. Attendi che GitHub Pages mostri l'indirizzo HTTPS pubblicato.
4. Apri quell'indirizzo in Chrome su Android.
5. Apri il menu ⋮ e scegli **Installa app** oppure **Aggiungi a schermata Home** (la voce varia per dispositivo/browser).

Alternativa: carica la cartella su Netlify tramite il suo flusso di deploy manuale. Usa sempre l'indirizzo HTTPS assegnato dal servizio.

## Funzioni presenti

- Dashboard con livello, XP e percentuale di completamento giornaliero.
- Missioni giornaliere, settimanali con giorni selezionati, e missioni una tantum.
- Creazione, modifica, archiviazione, riattivazione ed eliminazione.
- Completamento/reapertura e XP associati a ogni occorrenza.
- Bonus giornaliero di 25 XP dopo almeno una missione completata.
- Livelli con progressione crescente.
- Achievement, serie di costanza, grafici degli ultimi 7 giorni.
- Backup JSON, ripristino JSON e CSV compatibile con Excel.
- Cache del guscio applicativo per uso offline dopo la prima apertura.

## Nota importante sulle notifiche

Questa versione usa le notifiche standard del browser e controlla gli orari mentre la pagina dell'app è aperta. **Non garantisce notifiche puntuali quando l'app è chiusa o il telefono è in risparmio energetico.** Per notifiche affidabili in background occorre una soluzione aggiuntiva (ad esempio push con backend o un wrapper nativo).

## Dati e privacy

Non è previsto un account né un server: missioni e progressi restano nel browser/dispositivo. I dati del sito possono essere cancellati dalle impostazioni del browser; in quel caso usa il backup JSON per ripristinarli. Esporta regolarmente un backup e conservalo in un posto sicuro.

## Note della versione 1.0

- Nessuna sincronizzazione tra dispositivi.
- L'importazione del backup sostituisce lo stato attuale.
- I grafici mostrano gli ultimi 7 giorni.
- I font esterni sono un miglioramento estetico opzionale; se offline si usano i font di sistema.

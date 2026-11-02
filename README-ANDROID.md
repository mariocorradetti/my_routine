# LEVEL UP — Android

Questo progetto mantiene l'app HTML/CSS/JavaScript originale nella cartella `www/` e la esegue su Android tramite Capacitor.

## Build automatica

1. Apri la scheda **Actions** del repository GitHub.
2. Se richiesto, abilita GitHub Actions per il repository.
3. Seleziona **Build LEVEL UP Android APK**.
4. Premi **Run workflow** e scegli il branch `android-native`.
5. Attendi il completamento del job.
6. Apri il run completato e scarica l'artifact **LEVEL-UP-Android-APK**.
7. Estrai lo ZIP: contiene `app-debug.apk`.

## Installazione

Trasferisci `app-debug.apk` sul telefono Android e aprilo. Se richiesto, autorizza l'installazione da quella sorgente.

## Notifiche

Le notifiche sono locali e vengono programmate sul dispositivo per i successivi 30 giorni in base agli orari delle missioni. In Android 13+ è necessario autorizzare le notifiche. Su Android 12+ può essere necessario abilitare anche **Sveglie e promemoria** per una pianificazione precisa. Le restrizioni di risparmio energetico del dispositivo possono comunque influire sulla puntualità.

## Dati

I dati restano nel database locale dell'app. Usa **Profilo → Esporta backup completo** prima di disinstallare o cambiare dispositivo.

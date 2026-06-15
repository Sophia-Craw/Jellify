# Jellify 

Music streaming on your own hardware!

# What is Jellify?

Jellify is the successor to Jfin, a Jellyfin compatible music streaming application.

Jfin lacked in a lot of features and wasn't the greatest to use. So, I've developed Jellify, the app that really takes music streaming on Jellyfin seriously.

# What makes Jellify stand out?

Jellify tries really hard to match the fedelity of popular music streaming platforms, without the enshittified UI choices made over the past recent years.

You can expect Jellify to work very similarly to music software you're already used to and Jellify adapts to your Jellyfin library.

Some notiable ways Jellify adapts is whether you've just dumped all your music into a single collection or maticulously organize it all into folders, Jellify will display your music all the same and treat it all the same.

Jellify also let's you create, sort and modify playlists easily and intuitively as you'd expect. 

# Where can I use Jellify?

Jellify supports macOS, Windows, Android and iOS. For now you have to build it yourself. but, soon there will be builds for macOS, Windows and Android for download.


# For Developers & Contributors

To get started developing and contributing for Jellify, please see the following below: 


Clone the repo:
```bash
git clone <this-repo.git>
```

Change into the jellify directory:
```bash
cd jellify
```

Install NodeJS dependencies:
```bash
npm i
```


## Web
```bash
npm run dev
```

## Electron
```bash
npm run build
npm run electron
```

## Capacitor (Mobile)
```bash
npm run build:cap
npm run cap:open
```
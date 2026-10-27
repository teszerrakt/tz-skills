# Every toast is a script

Each host's toast is a separate script with one contract: it reads a JSON spec file and prints one answer line (`choice: <label>`, `text: <words>`, `open`, `later` or `timeout`). The Windows card must be its own process anyway, because WPF needs PowerShell, so the Linux toasts are scripts too rather than code inside the command center, and the server has one way to show a toast on every host. Each script can also be run alone from a shell, which is how a backend is checked without a run.

On a Linux desktop the card is drawn in Qt Quick (`toast-card.qml`) and pinned to the screen corner with layer-shell-qt, so it matches the Windows card. QML can only write to the log, so `toast-card.ts` runs it and turns the log into the contract's answer line. Where layer shell is missing (GNOME, X11, or the module is not installed) the toast falls back to a desktop notification through `notify-send`.

## Considered Options

- Run the Linux toast inside the server. Rejected: two ways to show a toast, and a Linux change could not be checked without starting the server.
- A desktop notification alone. Tried first and replaced: the notification daemon owns the padding, line spacing and button gaps, and a notification can set none of them, so the card read as cramped. It stays as the fallback.
- A plain window without layer shell. Rejected: a tiling window manager such as Hyprland tiles it unless the user adds a window rule for it.
- GTK4 with gtk4-layer-shell. Written first and replaced: the same card, but Qt and layer-shell-qt were already installed on the machine it was built for, and QML reads close to the Windows card's XAML.

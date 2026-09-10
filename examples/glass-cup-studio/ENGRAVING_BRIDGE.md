# Engraving preview bridge v1

Scene Studio opens `?engravingPreview=1&session=<crypto.randomUUID()>`. The URL contains no image or credentials. This page is an independent session: draft hydration and autosave are disabled, including while waiting or after a failure. Normal image import and existing project export remain available.

Every message has `{ bridge: 'engraving-preview-v1', session, type }`. Both sides verify the exact peer Window, origin, and session. Production accepts `https://wilhelmzero.github.io`; the sender targets the img2threejs path. Development additionally permits the local sender at port 5179.

1. Sender posts `hello` every 500 ms, for at most 45 seconds.
2. Receiver responds `ready` after installing its listener.
3. Sender posts `image` once, with `payload: { blob, name, width, height, widthMm, heightMm, dpi, mode }`. Blob is PNG; mode is `dither` or `grayscale`. Pixel dimensions are integers, millimeter dimensions equal pixels / DPI * 25.4. Limits: 40 MiB, 40 million pixels, DPI 72–1200, filename at most 200 characters.
4. Receiver decodes and checks dimensions, creates the default transparent cup project, fits the artwork uniformly within 90% of the printable area, and sets non-repeating centered engraving mode. White becomes matte white, black becomes transparent, gray becomes fractional opacity.
5. Receiver posts `applied` only after the decoded image has been painted into the Three.js texture. Duplicate pending imports are ignored; completed imports return the same acknowledgment without importing twice. Invalid data or decoding failure returns `error`.

Closing the modal or changing output mode cancels the sender listener and computation. A blocked/closed window, timeout, or receiver error offers reopening 3D preview or downloading the PNG for manual import; after manual import, enable the engraving checkbox. No AI API or upload server is involved. Glass appearance is a material simulation, not a guarantee of machine results.

/* ============================================================
   Dennis Kim — Google Analytics 4
   Loaded from the <head> of every page. One place to change.
   ============================================================ */
(function () {
  'use strict';

  /* The measurement id for the denniskim.org web data stream.
     Analytics → Admin → Data streams → Web → "Measurement ID".
     It always looks like G-XXXXXXXXXX. This is the only line
     that needs editing to switch, disable or replace the property. */
  var MEASUREMENT_ID = 'G-VGMKHTKGK2';

  /* If the id is ever cleared back to the placeholder, or mistyped, do
     nothing at all: loading gtag.js with a bad id fetches a 404 on every
     page view and logs a console error, so a misconfigured site stays
     silent rather than noisy. The placeholder is spelled out on its own
     because it is all letters and digits — a shape test alone would let
     it through. */
  var PLACEHOLDER = 'G-' + 'XXXXXXXXXX';
  if (MEASUREMENT_ID === PLACEHOLDER) return;
  if (!/^G-[A-Z0-9]{6,}$/.test(MEASUREMENT_ID)) return;

  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }

  gtag('js', new Date());
  gtag('config', MEASUREMENT_ID);

  /* gtag.js reads the queue above once it arrives, so the queue is
     filled first and the library fetched after — nothing is lost if
     the network is slow, and the page never waits on analytics. */
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(MEASUREMENT_ID);
  document.head.appendChild(s);
})();

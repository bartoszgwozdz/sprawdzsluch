const GA4_ID = 'G-GEPKF2D516';
const CONSENT_KEY = 'cookie_consent';

function loadGA4() {
    if (window._ga4Loaded) return;
    window._ga4Loaded = true;

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_ID;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    function gtag() { dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', GA4_ID);
}

function hideBanner() {
    const banner = document.getElementById('cookie-banner');
    if (banner) {
        banner.classList.add('cookie-banner--hidden');
        setTimeout(() => banner.remove(), 300);
    }
}

function showBanner() {
    const banner = document.createElement('div');
    banner.id = 'cookie-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Zgoda na pliki cookie');
    banner.innerHTML = `
        <div class="cookie-banner-inner">
            <p class="cookie-banner-text">
                Używamy plików cookie Google Analytics, aby analizować ruch na stronie i poprawiać jakość usług.
                <a href="/polityka-prywatnosci">Polityka prywatności</a>
            </p>
            <div class="cookie-banner-buttons">
                <button id="cookie-accept" class="cookie-btn cookie-btn--primary">Akceptuję</button>
                <button id="cookie-reject" class="cookie-btn cookie-btn--secondary">Tylko niezbędne</button>
            </div>
        </div>
    `;
    document.body.appendChild(banner);

    document.getElementById('cookie-accept').addEventListener('click', function () {
        localStorage.setItem(CONSENT_KEY, 'accepted');
        loadGA4();
        hideBanner();
    });

    document.getElementById('cookie-reject').addEventListener('click', function () {
        localStorage.setItem(CONSENT_KEY, 'rejected');
        hideBanner();
    });
}

(function () {
    const consent = localStorage.getItem(CONSENT_KEY);
    if (consent === 'accepted') {
        loadGA4();
    } else if (!consent) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', showBanner);
        } else {
            showBanner();
        }
    }
})();

(function () {
    const RECAPTCHA_SITE_KEY = process.env.RECAPTCHA;
    const BUILD_ENV = process.env.BUILD_ENV;
    let recaptchaLoadPromise = null;

    function loadRecaptchaScript(url) {
        return new Promise(function (resolve, reject) {
            const script = document.createElement('script');
            script.src = url;
            script.async = true;
            script.defer = true;
            script.onload = function () {
                resolve();
            };
            script.onerror = function () {
                reject(new Error('Unable to load reCAPTCHA script: ' + url));
            };
            document.head.appendChild(script);
        });
    }

    function loadRecaptcha() {
        if (window.grecaptcha && typeof window.grecaptcha.execute === 'function') {
            return Promise.resolve();
        }

        if (recaptchaLoadPromise) {
            return recaptchaLoadPromise;
        }

        const primaryUrl = 'https://www.google.com/recaptcha/api.js?render=' + encodeURIComponent(RECAPTCHA_SITE_KEY || '');
        const fallbackUrl = 'https://www.recaptcha.net/recaptcha/api.js?render=' + encodeURIComponent(RECAPTCHA_SITE_KEY || '');

        recaptchaLoadPromise = loadRecaptchaScript(primaryUrl)
            .catch(function () {
                return loadRecaptchaScript(fallbackUrl);
            })
            .catch(function () {
                throw new Error('Unable to load reCAPTCHA script from all known hosts');
            })
            .catch(function (err) {
                // Allow retry on the next user interaction/submit after a transient failure.
                recaptchaLoadPromise = null;
                throw err;
            });

        return recaptchaLoadPromise;
    }

    function getBrowserInfo() {
        const ua = navigator.userAgent;
        if (/Edg\//.test(ua))     { return { name: 'Edge',    version: (ua.match(/Edg\/(\d+)/)     || [])[1] || '' }; }
        if (/Chrome\//.test(ua))  { return { name: 'Chrome',  version: (ua.match(/Chrome\/(\d+)/)  || [])[1] || '' }; }
        if (/Firefox\//.test(ua)) { return { name: 'Firefox', version: (ua.match(/Firefox\/(\d+)/) || [])[1] || '' }; }
        if (/Safari\//.test(ua))  { return { name: 'Safari',  version: (ua.match(/Version\/(\d+)/) || [])[1] || '' }; }
        return { name: 'Unknown', version: '' };
    }

    function getOS() {
        const ua = navigator.userAgent;
        if (/Windows/.test(ua))     { return 'Windows'; }
        if (/Mac OS/.test(ua))      { return 'Mac OS'; }
        if (/Android/.test(ua))     { return 'Android'; }
        if (/iPhone|iPad/.test(ua)) { return 'iOS'; }
        if (/Linux/.test(ua))       { return 'Linux'; }
        return 'Unknown';
    }

    function fieldValue(name) {
        const el = form.querySelector('[name="' + name + '"]');
        return el ? el.value : '';
    }

    function resolveFranchise() {
        const explicitFranchise = fieldValue('franchise').trim();
        if (explicitFranchise) {
            return explicitFranchise;
        }
        const hostOverrides = {
            'www.business.qld.gov.au': 'Business Queensland',
            'www.familywellbeingqld.org.au': 'Aboriginal and Torres Strait Islander Family Wellbeing Services',
            'www.forgov.qld.gov.au': 'Government employees'
        };
        if (hostOverrides[window.location.hostname]) {
            return hostOverrides[window.location.hostname];
        }
        return window.location.pathname.split('/').filter(Boolean)[0] || '';
    }

    const form = document.getElementById('page-feedback-form');
    const details = document.getElementById('page-feedback-details');
    const label = document.getElementById('pageFeedbackCommentLabel');
    const radios = form.querySelectorAll('input[name="feedback-satisfaction"]');
    const success = document.getElementById('page-feedback-success');
    const error = document.getElementById('page-feedback-error');
    const submitButton = document.getElementById('page-feedback-submit');
    const submitButtonDefault = submitButton.innerHTML;
    const submitButtonLoading = '<div class="spinner-border spinner-border-sm me-2" aria-hidden="true"></div>Submitting...';

    function setButtonLoading(loading) {
        if (loading) {
            submitButton.classList.add('btn-progress', 'loading');
            submitButton.innerHTML = submitButtonLoading;
            submitButton.disabled = true;
        } else {
            submitButton.disabled = false;
            submitButton.classList.remove('btn-progress', 'loading');
            submitButton.innerHTML = submitButtonDefault;
        }
    }

    radios.forEach(function (radio) {
        radio.addEventListener('change', function () {
            loadRecaptcha().catch(function (err) {
                console.error('reCAPTCHA preload error:', err);
            });
            details.hidden = false;
            if (radio.id === 'feedback-useful-yes') {
                label.textContent = 'What worked well for you (optional)';
            }
            if (radio.id === 'feedback-useful-no') {
                label.textContent = 'What didn’t work for you (optional)';
            }
        });
    });

    form.addEventListener('submit', function (event) {
        event.preventDefault();

        error.hidden = true;
        success.hidden = true;

        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        setButtonLoading(true);
        loadRecaptcha()
            .then(function () {
                return new Promise(function (resolve, reject) {
                    if (!window.grecaptcha || typeof window.grecaptcha.ready !== 'function') {
                        reject(new Error('reCAPTCHA is not available'));
                        return;
                    }
                    window.grecaptcha.ready(resolve);
                });
            })
            .then(function () {
                return window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'feedback' });
            })
                .then(function (token) {
                    const satisfactionRadio = form.querySelector('input[name="feedback-satisfaction"]:checked');
                    const tzOffset = -new Date().getTimezoneOffset();
                    const commentsText = document.getElementById('pageFeedbackComment').value.trim();
                    const payload = {
                        data: {
                            'feedback-satisfaction': satisfactionRadio ? satisfactionRadio.value : '',
                            'feedback-a':       fieldValue('feedback-a'),
                            'feedback-b':       fieldValue('feedback-b'),
                            'feedback-c':       fieldValue('feedback-c'),
                            'feedback-d':       fieldValue('feedback-d'),
                            'dataset-owner':    fieldValue('dataset-owner'),
                            'page-title':       document.title,
                            'page-url':         window.location.href,
                            'page-referer':     document.referrer,
                            'rspUsrAgent':      navigator.userAgent,
                            'browserName':      getBrowserInfo(),
                            'OS':               getOS(),
                            'franchise':        resolveFranchise(),
                            'captchaCatch':     BUILD_ENV,
                            'captcha-honeypot': fieldValue('captcha'),
                            'feedback-captcha': fieldValue('feedback-captcha'),
                            'comments':         commentsText || '[no comment provided]',
                            'submit':           true,
                            'captcha':          { token: token }
                        },
                        metadata: {
                            timezone:    Intl.DateTimeFormat().resolvedOptions().timeZone,
                            offset:      tzOffset,
                            origin:      window.location.origin,
                            referrer:    document.referrer,
                            browserName: navigator.appName,
                            userAgent:   navigator.userAgent,
                            pathName:    window.location.pathname,
                            onLine:      navigator.onLine
                        },
                        state:  'submitted',
                        _vnote: ''
                    };

                    fetch(form.action, {
                        method: form.method || 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    })
                        .then(function (response) {
                            if (!response.ok) {
                                throw new Error('Submission failed with status ' + response.status);
                            }
                            form.hidden = true;
                            success.hidden = false;
                        })
                        .catch(function (err) {
                            console.error('Feedback form submission error:', err);
                            form.hidden = true;
                            error.hidden = false;
                            error.removeAttribute('hidden');
                        });
                })
                .catch(function (err) {
                    console.error('reCAPTCHA error:', err);
                    form.hidden = true;
                    error.hidden = false;
                    error.removeAttribute('hidden');
                });
    });
})();
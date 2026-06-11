(function () {
  const RECAPTCHA_SITE_KEY = process.env.RECAPTCHA;
  const BUILD_ENV = process.env.BUILD_ENV;
  let recaptchaLoadPromise = null;
  let recaptchaOwnedByWidget = false;
  const existingBadgesAtInit = new Set(document.querySelectorAll('.grecaptcha-badge'));

  function tagWidgetOwnedBadges() {
    if (!recaptchaOwnedByWidget) {
      return;
    }

    const badges = document.querySelectorAll('.grecaptcha-badge');
    badges.forEach(function (badge) {
      if (!existingBadgesAtInit.has(badge)) {
        badge.setAttribute('data-feedback-widget-badge', 'true');
      }
    });
  }

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

    const primaryUrl =
      'https://www.google.com/recaptcha/api.js?render=' +
      encodeURIComponent(RECAPTCHA_SITE_KEY || '');
    const fallbackUrl =
      'https://www.recaptcha.net/recaptcha/api.js?render=' +
      encodeURIComponent(RECAPTCHA_SITE_KEY || '');

    recaptchaOwnedByWidget = true;

    recaptchaLoadPromise = loadRecaptchaScript(primaryUrl)
      .catch(function () {
        return loadRecaptchaScript(fallbackUrl);
      })
      .then(function () {
        tagWidgetOwnedBadges();
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
    if (/Edg\//.test(ua)) {
      return { name: 'Edge', version: (ua.match(/Edg\/(\d+)/) || [])[1] || '' };
    }
    if (/Chrome\//.test(ua)) {
      return {
        name: 'Chrome',
        version: (ua.match(/Chrome\/(\d+)/) || [])[1] || '',
      };
    }
    if (/Firefox\//.test(ua)) {
      return {
        name: 'Firefox',
        version: (ua.match(/Firefox\/(\d+)/) || [])[1] || '',
      };
    }
    if (/Safari\//.test(ua)) {
      return {
        name: 'Safari',
        version: (ua.match(/Version\/(\d+)/) || [])[1] || '',
      };
    }
    return { name: 'Unknown', version: '' };
  }

  function getOS() {
    const ua = navigator.userAgent;
    if (/Windows/.test(ua)) {
      return 'Windows';
    }
    if (/Mac OS/.test(ua)) {
      return 'Mac OS';
    }
    if (/Android/.test(ua)) {
      return 'Android';
    }
    if (/iPhone|iPad/.test(ua)) {
      return 'iOS';
    }
    if (/Linux/.test(ua)) {
      return 'Linux';
    }
    return 'Unknown';
  }

  function fieldValue(name) {
    const el = form.querySelector('[name="' + name + '"]');
    return el ? el.value : '';
  }

  function setFieldValue(name, value) {
    const el = form.querySelector('[name="' + name + '"]');
    if (el) {
      el.value = value;
    }
  }

  function resolveFranchise() {
    const explicitFranchise = fieldValue('franchise').trim();
    if (explicitFranchise) {
      return explicitFranchise;
    }
    const hostOverrides = {
      'www.business.qld.gov.au': 'Business Queensland',
      'www.familywellbeingqld.org.au':
        'Aboriginal and Torres Strait Islander Family Wellbeing Services',
      'www.forgov.qld.gov.au': 'Government employees',
    };
    if (hostOverrides[window.location.hostname]) {
      return hostOverrides[window.location.hostname];
    }
    return window.location.pathname.split('/').filter(Boolean)[0] || '';
  }

  function isSuccessfulResponsePayload(payload) {
    return (
      payload &&
      typeof payload === 'object' &&
      typeof payload.success === 'string' &&
      payload.success.toLowerCase() === 'true'
    );
  }

  function isKnownErrorHtmlResponse(responseText) {
    const parser = new DOMParser();
    const documentNode = parser.parseFromString(responseText, 'text/html');
    const titleText = (documentNode.querySelector('title')?.textContent || '').toLowerCase();
    const bodyText = (documentNode.body?.textContent || responseText)
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
    const errorMarkers = [
      'an error has occurred',
      'unable to continue',
      'recaptcha failed',
      'no email will be sent',
    ];

    return errorMarkers.some(function (marker) {
      return titleText.includes(marker) || bodyText.includes(marker);
    });
  }

  function isSuccessfulSubmissionResponse(responseText, contentType) {
    const trimmedResponse = responseText.trim();

    if (!trimmedResponse) {
      throw new Error('Submission response was empty');
    }

    try {
      const responsePayload = JSON.parse(trimmedResponse);
      if (!isSuccessfulResponsePayload(responsePayload)) {
        throw new Error('Submission response did not return success="true"');
      }
      return true;
    } catch (parseError) {
      const looksLikeHtml =
        (contentType || '').toLowerCase().includes('text/html') || trimmedResponse.startsWith('<');

      if (!looksLikeHtml) {
        throw new Error('Submission response was not valid JSON');
      }

      if (isKnownErrorHtmlResponse(trimmedResponse)) {
        throw new Error('Submission response returned an HTML error page');
      }

      return true;
    }
  }

  function appendFormField(params, key, value) {
    params.append(key, value == null ? '' : String(value));
  }

  function appendObjectFields(params, prefix, value) {
    if (value == null) {
      appendFormField(params, prefix, '');
      return;
    }

    if (typeof value === 'object' && !Array.isArray(value)) {
      Object.keys(value).forEach(function (childKey) {
        appendObjectFields(params, prefix + '.' + childKey, value[childKey]);
      });
      return;
    }

    appendFormField(params, prefix, value);
  }

  const form = document.getElementById('page-feedback-form');
  const details = document.getElementById('page-feedback-details');
  const label = document.getElementById('pageFeedbackCommentLabel');
  const radios = form.querySelectorAll('input[name="feedback-satisfaction"]');
  const success = document.getElementById('page-feedback-success');
  const error = document.getElementById('page-feedback-error');
  const submitButton = document.getElementById('page-feedback-submit');
  const submitButtonDefault = submitButton.innerHTML;
  const submitButtonLoading =
    '<div class="spinner-border spinner-border-sm me-2" aria-hidden="true"></div>Submitting...';

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

  function setRecaptchaBadgeVisible(visible) {
    tagWidgetOwnedBadges();

    const widgetBadges = document.querySelectorAll(
      '.grecaptcha-badge[data-feedback-widget-badge="true"]'
    );
    if (widgetBadges.length === 0) {
      return;
    }

    widgetBadges.forEach(function (badge) {
      badge.style.visibility = visible ? 'visible' : 'hidden';
      badge.style.opacity = visible ? '1' : '0';
      badge.style.pointerEvents = visible ? 'auto' : 'none';
    });
  }

  radios.forEach(function (radio) {
    radio.addEventListener('change', function () {
      loadRecaptcha().catch(function (err) {
        console.error('reCAPTCHA preload error:', err);
      });
      details.hidden = false;
    });
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    error.hidden = true;
    success.hidden = true;
    setRecaptchaBadgeVisible(true);

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
        return window.grecaptcha.execute(RECAPTCHA_SITE_KEY, {
          action: 'feedback',
        });
      })
      .then(function (token) {
        tagWidgetOwnedBadges();
        const satisfactionRadio = form.querySelector('input[name="feedback-satisfaction"]:checked');
        const satisfactionValue = satisfactionRadio ? satisfactionRadio.value : '';
        const tzOffset = -new Date().getTimezoneOffset();
        const commentsText = document.getElementById('pageFeedbackComment').value.trim();
        const franchise = resolveFranchise();
        setFieldValue('captchaCatch', BUILD_ENV);
        setFieldValue('g-recaptcha-response', token);
        setFieldValue('franchise', franchise);
        const payload = {
          data: {
            'feedback-satisfaction': satisfactionValue,
            'feedback-a': fieldValue('feedback-a'),
            'feedback-b': fieldValue('feedback-b'),
            'feedback-c': fieldValue('feedback-c'),
            'feedback-d': fieldValue('feedback-d'),
            'dataset-owner': fieldValue('dataset-owner'),
            'page-title': document.title,
            'page-url': window.location.href,
            'page-referer': document.referrer,
            rspUsrAgent: navigator.userAgent,
            browserName: getBrowserInfo(),
            OS: getOS(),
            franchise: franchise,
            captchaCatch: BUILD_ENV,
            captcha: '',
            'captcha-honeypot': fieldValue('captcha'),
            'feedback-captcha': fieldValue('feedback-captcha'),
            'g-recaptcha-response': token,
            comments: commentsText || '[no comment provided]',
            submit: true,
          },
          metadata: {
            datestamp: new Date().toISOString(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            offset: tzOffset,
            origin: window.location.origin,
            referrer: document.referrer || '[no referrer captured]',
            browserName: navigator.appName,
            userAgent: navigator.userAgent,
            pathName: window.location.pathname,
            onLine: navigator.onLine,
          },
          state: 'submitted',
          _vnote: '',
        };

        const formBody = new URLSearchParams();
        appendObjectFields(formBody, 'data', payload.data);
        appendObjectFields(formBody, 'metadata', payload.metadata);
        appendFormField(formBody, 'state', payload.state);
        appendFormField(formBody, '_vnote', payload._vnote);

        const submitUrl = new URL(form.action);
        submitUrl.searchParams.set('g-recaptcha-response', token);

        fetch(submitUrl.toString(), {
          method: 'POST',
          body: formBody,
        })
          .then(function (response) {
            if (!response.ok) {
              throw new Error('Submission failed with status ' + response.status);
            }

            return response.text().then(function (responseText) {
              isSuccessfulSubmissionResponse(
                responseText,
                response.headers.get('content-type') || ''
              );

              form.hidden = true;
              success.textContent = 'Thank you for your feedback.';
              success.hidden = false;
              setRecaptchaBadgeVisible(false);
            });
          })
          .catch(function (err) {
            console.error('Feedback form submission error:', err);
            // Keep the form available so users can retry and get a fresh token.
            form.hidden = false;
            setButtonLoading(false);
            setRecaptchaBadgeVisible(true);
            error.textContent =
              'Something went wrong and your feedback was not submitted. Please try again.';
            error.hidden = false;
            error.removeAttribute('hidden');
          });
      })
      .catch(function (err) {
        console.error('reCAPTCHA error:', err);
        // Keep the form visible so users can retry after token/script issues.
        form.hidden = false;
        setButtonLoading(false);
        setRecaptchaBadgeVisible(true);
        error.textContent =
          'Something went wrong and your feedback was not submitted. Please try again.';
        error.hidden = false;
        error.removeAttribute('hidden');
      });
  });
})();

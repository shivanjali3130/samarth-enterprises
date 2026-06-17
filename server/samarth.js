// Header scroll elevation script
(() => {
  const header = document.querySelector('.site-header');
  
  function updateHeaderShadow() {
    if (!header) return;
    if (window.scrollY > 8) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }

  window.addEventListener('scroll', updateHeaderShadow, { passive: true });
  document.addEventListener('DOMContentLoaded', updateHeaderShadow);
  // Run once in case page is already scrolled
  updateHeaderShadow();
})();

// Simple home slider script
(function () {
  const slider = document.querySelector('.home-slider');
  if (!slider) return;

  const slides = Array.from(slider.querySelectorAll('.slide'));
  const prevBtn = slider.querySelector('.slider-prev');
  const nextBtn = slider.querySelector('.slider-next');
  const dotsContainer = slider.querySelector('.slider-dots');
  
  if (!slides.length || !prevBtn || !nextBtn || !dotsContainer) return;
  
  let current = 0;
  let timer = null;

  function renderDots() {
    dotsContainer.innerHTML = '';
    slides.forEach((s, i) => {
      const btn = document.createElement('button');
      btn.setAttribute('aria-label', `Go to slide ${i + 1}`);
      btn.addEventListener('click', () => show(i));
      if (i === current) btn.classList.add('active');
      dotsContainer.appendChild(btn);
    });
  }

  function show(index) {
    slides.forEach((s, i) => s.classList.toggle('active', i === index));
    current = index;
    const dots = dotsContainer.querySelectorAll('button');
    dots.forEach((d, i) => d.classList.toggle('active', i === index));
    resetTimer();
  }

  function prev() { 
    show((current - 1 + slides.length) % slides.length); 
  }
  
  function next() { 
    show((current + 1) % slides.length); 
  }

  function resetTimer() {
    if (timer) clearInterval(timer);
    timer = setInterval(next, 4500);
  }

  prevBtn.addEventListener('click', prev);
  nextBtn.addEventListener('click', next);

  renderDots();
  show(0);
  resetTimer();
})();

/* --------------------------------------------------------------
   Enquiry Modal Handling + Submit to Server
   -------------------------------------------------------------- */
(function () {
  const modal = document.getElementById('enquiry-modal');
  if (!modal) return;

  const backdrop = modal.querySelector('.modal-backdrop');
  const closeBtn = modal.querySelector('.modal-close');
  const serviceLabel = modal.querySelector('#enquiry-service');
  const serviceInput = modal.querySelector('#enquiry-service-input');
  const form = modal.querySelector('#enquiry-form');
  const statusEl = document.getElementById('enquiry-status');

  if (!form) {
    console.error('Enquiry form not found');
    return;
  }

  /* ------------------------- Open Modal ------------------------- */
  function openModal(serviceName) {
    modal.setAttribute('aria-hidden', 'false');

    if (serviceLabel) serviceLabel.textContent = serviceName;
    if (serviceInput) serviceInput.value = serviceName;

    document.body.style.overflow = 'hidden';

    // Autofocus on the "Name" field
    const firstField = form.querySelector('input[name="name"]');
    if (firstField) {
      setTimeout(() => firstField.focus(), 100);
    }
  }

  /* ------------------------- Close Modal ------------------------ */
  function closeModal() {
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';

    if (statusEl) {
      statusEl.textContent = '';
      statusEl.style.color = '';
    }
  }

  /* -------------------- Open modal from buttons ----------------- */
  document.querySelectorAll('.contact-cta').forEach((btn) => {
    btn.addEventListener('click', function () {
      const svc = this.dataset.service || this.getAttribute('data-service') || 'General Enquiry';
      openModal(svc);
    });
  });

  /* -------------------------- Close events ----------------------- */
  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }
  
  if (backdrop) {
    backdrop.addEventListener('click', closeModal);
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') {
      closeModal();
    }
  });

  /* --------------------------- Submit Form ----------------------- */
  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    if (statusEl) {
      statusEl.style.color = '#0a6';
      statusEl.textContent = 'Submitting...';
    }

    // Build request object
    const fd = new FormData(form);
    const entry = {
      name: (fd.get('name') || '').trim(),
      phone: (fd.get('phone') || '').trim(),
      email: (fd.get('email') || '').trim(),
      location: (fd.get('location') || '').trim(),
      service: (fd.get('service') || '').trim(),
      message: (fd.get('message') || '').trim(),
    };

    // Basic client-side validation
    if (!entry.name || !entry.phone || !entry.email) {
      if (statusEl) {
        statusEl.style.color = '#b33';
        statusEl.textContent = 'Please fill in all required fields.';
      }
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(entry.email)) {
      if (statusEl) {
        statusEl.style.color = '#b33';
        statusEl.textContent = 'Please enter a valid email address.';
      }
      return;
    }

    try {
      const apiUrl = new URL('/api/enquiry', window.location.origin).toString();
      console.log('📤 Sending enquiry to:', apiUrl);

      const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });

      console.log('📤 Response URL:', resp.url);
      console.log('📤 Response status:', resp.status);
      console.log('📤 Response headers:', resp.headers);

      const text = await resp.text();
      console.log('Response text:', text);

      let data = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch (parseError) {
          console.warn('Failed to parse server JSON:', parseError.message);
        }
      }

      if (resp.ok && data?.success) {
        if (statusEl) {
          statusEl.style.color = '#0a6';
          statusEl.textContent = data.message || 'Submitted successfully — thank you!';
        }

        form.reset();
        setTimeout(closeModal, 1500);
      } else {
        const errorMessage = data?.error || data?.msg || resp.statusText || 'Server error. Please try again.';
        throw new Error(errorMessage || 'Submission failed.');
      }
    } catch (err) {
      console.error('❌ Submission failed:', err);

      if (statusEl) {
        statusEl.style.color = '#b33';
        statusEl.textContent = err.message || 'Submission failed. Please try again later.';
      }

      // Don't auto-close on error so user can try again
      setTimeout(() => {
        if (statusEl) statusEl.textContent = '';
      }, 3000);
    }
  });

  /* -------------------- Prevent multiple submissions ------------ */
  let isSubmitting = false;
  form.addEventListener('submit', function(e) {
    if (isSubmitting) {
      e.preventDefault();
      return;
    }
    isSubmitting = true;
    setTimeout(() => { isSubmitting = false; }, 3000);
  }, true);
})();
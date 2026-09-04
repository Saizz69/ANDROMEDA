/**
 * Family Misinformation Decoder — Web Companion Controller
 * Connects frontend UI to FastAPI backend endpoints (/api/check-web & /api/check-payload)
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const sampleChips = document.querySelectorAll('.chip-btn');

  // Text Form Elements
  const formText = document.getElementById('form-text-check');
  const textInput = document.getElementById('text-input');
  const langSelect = document.getElementById('language-select');

  // Image Form Elements
  const formImage = document.getElementById('form-image-check');
  const imageDropzone = document.getElementById('image-dropzone');
  const imageFileInput = document.getElementById('image-file-input');
  const imagePreviewContainer = document.getElementById('image-preview-container');
  const imagePreview = document.getElementById('image-preview');
  const imageFilename = document.getElementById('image-filename');
  const btnRemoveImage = document.getElementById('btn-remove-image');
  const imageContextText = document.getElementById('image-context-text');

  // Audio Form Elements
  const formAudio = document.getElementById('form-audio-check');
  const audioDropzone = document.getElementById('audio-dropzone');
  const audioFileInput = document.getElementById('audio-file-input');
  const audioPreviewContainer = document.getElementById('audio-preview-container');
  const audioPreview = document.getElementById('audio-preview');
  const audioFilename = document.getElementById('audio-filename');
  const btnRemoveAudio = document.getElementById('btn-remove-audio');
  const audioContextText = document.getElementById('audio-context-text');

  // UI States & Results Elements
  const loadingState = document.getElementById('loading-state');
  const resultsSection = document.getElementById('results-section');
  const verdictBanner = document.getElementById('verdict-banner');
  const verdictIcon = document.getElementById('verdict-icon');
  const verdictStatusTitle = document.getElementById('verdict-status-title');
  const verdictCategoryTitle = document.getElementById('verdict-category-title');
  const explanationText = document.getElementById('explanation-text');
  const timelineText = document.getElementById('timeline-text');
  const tacticsTags = document.getElementById('tactics-tags');
  const sourcesContainer = document.getElementById('sources-container');
  const correctionCardImg = document.getElementById('correction-card-img');
  const btnDownloadCard = document.getElementById('btn-download-card');
  const btnCopyExplanation = document.getElementById('btn-copy-explanation');
  const btnResetCheck = document.getElementById('btn-reset-check');
  const toast = document.getElementById('toast');

  let selectedImageFile = null;
  let selectedAudioFile = null;
  let lastResultData = null;

  // 1. Tab Switching
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.tab;
      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(targetId).classList.add('active');
    });
  });

  // 2. Preset Sample Chips
  sampleChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const claim = chip.dataset.claim;
      if (claim) {
        // Switch to text tab
        document.getElementById('btn-tab-text').click();
        textInput.value = claim;
        submitTextClaim(claim, langSelect.value);
      }
    });
  });

  // 3. Image Drag & Drop and Preview Handlers
  setupFileDrop(imageDropzone, imageFileInput, (file) => {
    if (file && file.type.startsWith('image/')) {
      selectedImageFile = file;
      const reader = new FileReader();
      reader.onload = (e) => {
        imagePreview.src = e.target.result;
        imageFilename.textContent = file.name;
        imagePreviewContainer.style.display = 'flex';
        imageDropzone.querySelector('.drop-content').style.display = 'none';
      };
      reader.readAsDataURL(file);
    }
  });

  btnRemoveImage.addEventListener('click', (e) => {
    e.stopPropagation();
    selectedImageFile = null;
    imageFileInput.value = '';
    imagePreview.src = '';
    imagePreviewContainer.style.display = 'none';
    imageDropzone.querySelector('.drop-content').style.display = 'block';
  });

  // 4. Audio Drag & Drop and Preview Handlers
  setupFileDrop(audioDropzone, audioFileInput, (file) => {
    if (file && (file.type.startsWith('audio/') || file.name.match(/\.(mp3|wav|ogg|m4a)$/i))) {
      selectedAudioFile = file;
      const url = URL.createObjectURL(file);
      audioPreview.src = url;
      audioFilename.textContent = file.name;
      audioPreviewContainer.style.display = 'flex';
      audioDropzone.querySelector('.drop-content').style.display = 'none';
    }
  });

  btnRemoveAudio.addEventListener('click', (e) => {
    e.stopPropagation();
    selectedAudioFile = null;
    audioFileInput.value = '';
    audioPreview.src = '';
    audioPreviewContainer.style.display = 'none';
    audioDropzone.querySelector('.drop-content').style.display = 'block';
  });

  function setupFileDrop(dropzoneEl, fileInputEl, onFileSelected) {
    ['dragenter', 'dragover'].forEach(eventName => {
      dropzoneEl.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzoneEl.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzoneEl.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzoneEl.classList.remove('drag-over');
      });
    });

    dropzoneEl.addEventListener('drop', (e) => {
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        onFileSelected(e.dataTransfer.files[0]);
      }
    });

    fileInputEl.addEventListener('change', () => {
      if (fileInputEl.files && fileInputEl.files.length > 0) {
        onFileSelected(fileInputEl.files[0]);
      }
    });
  }

  // 5. Form Submissions
  formText.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = textInput.value.trim();
    if (!text) {
      alert('Please enter or paste a claim to check.');
      return;
    }
    submitTextClaim(text, langSelect.value);
  });

  formImage.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!selectedImageFile) {
      alert('Please select or drop an image file first.');
      return;
    }
    const formData = new FormData();
    formData.append('file', selectedImageFile);
    if (imageContextText.value.trim()) {
      formData.append('text_content', imageContextText.value.trim());
    }
    submitFormData(formData);
  });

  formAudio.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!selectedAudioFile) {
      alert('Please select or drop an audio voice note file first.');
      return;
    }
    const formData = new FormData();
    formData.append('file', selectedAudioFile);
    if (audioContextText.value.trim()) {
      formData.append('text_content', audioContextText.value.trim());
    }
    submitFormData(formData);
  });

  // API Call Handlers
  async function submitTextClaim(claimText, language = 'en') {
    showLoading();
    try {
      const response = await fetch('/api/check-payload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content_type: 'text',
          raw_content: claimText,
          extracted_text: claimText,
          language: language,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const data = await response.json();
      displayResults(data);
    } catch (err) {
      console.error('Error during verification:', err);
      alert(`Verification request failed: ${err.message}. Ensure backend is running.`);
      hideLoading();
    }
  }

  async function submitFormData(formData) {
    showLoading();
    try {
      const response = await fetch('/api/check-web', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const data = await response.json();
      displayResults(data);
    } catch (err) {
      console.error('Error during upload verification:', err);
      alert(`Verification request failed: ${err.message}. Ensure backend is running.`);
      hideLoading();
    }
  }

  function showLoading() {
    resultsSection.style.display = 'none';
    loadingState.style.display = 'block';
    loadingState.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function hideLoading() {
    loadingState.style.display = 'none';
  }

  // 6. Displaying Results
  function displayResults(data) {
    hideLoading();
    lastResultData = data;
    const verdict = data.verdict || {};
    const vType = (verdict.verdict || 'UNVERIFIED').toUpperCase();

    // Setup banner appearance
    verdictBanner.className = 'verdict-card';
    if (vType === 'FALSE') {
      verdictBanner.classList.add('verdict-false');
      verdictIcon.textContent = '⚠️';
      verdictStatusTitle.textContent = 'Please Double-Check This Message';
      verdictCategoryTitle.textContent = verdict.matched_claim ? 'Known Recurring Hoax' : 'Debunked / Fabricated Claim';
    } else if (vType === 'MISLEADING') {
      verdictBanner.classList.add('verdict-misleading');
      verdictIcon.textContent = '🔍';
      verdictStatusTitle.textContent = 'This Message Needs Context';
      verdictCategoryTitle.textContent = 'Partially Accurate / Missing Key Context';
    } else if (vType === 'TRUE') {
      verdictBanner.classList.add('verdict-true');
      verdictIcon.textContent = '✅';
      verdictStatusTitle.textContent = 'Verified Information';
      verdictCategoryTitle.textContent = 'Matches Authoritative & Verified Reports';
    } else {
      verdictBanner.classList.add('verdict-unverified');
      verdictIcon.textContent = '❓';
      verdictStatusTitle.textContent = 'Unverified Information';
      verdictCategoryTitle.textContent = 'Insufficient Official Evidence Available';
    }

    // Explanation Body
    explanationText.textContent = data.text_explanation || 'No explanation generated.';

    // Timeline Badge
    if (verdict.first_seen_date) {
      timelineText.textContent = `First observed circulating in ${verdict.first_seen_date}.`;
    } else {
      timelineText.textContent = 'No previous circulation date recorded.';
    }

    // Persuasion Tactics
    tacticsTags.innerHTML = '';
    const tags = verdict.manipulation_tags || [];
    if (tags.length > 0) {
      tags.forEach(tag => {
        const span = document.createElement('span');
        span.className = 'tactic-tag';
        span.textContent = formatTag(tag);
        tacticsTags.appendChild(span);
      });
    } else {
      const span = document.createElement('span');
      span.className = 'tactic-tag';
      span.style.background = 'rgba(255,255,255,0.06)';
      span.style.color = '#94a3b8';
      span.style.borderColor = 'transparent';
      span.textContent = 'Standard Information Pattern';
      tacticsTags.appendChild(span);
    }

    // Sources List
    sourcesContainer.innerHTML = '';
    const sources = verdict.sources || [];
    if (sources.length > 0) {
      sources.forEach(src => {
        const a = document.createElement('a');
        a.href = src;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.className = 'source-item';
        a.innerHTML = `🔗 ${src}`;
        sourcesContainer.appendChild(a);
      });
    } else {
      const p = document.createElement('p');
      p.style.fontSize = '0.85rem';
      p.style.color = '#94a3b8';
      p.textContent = 'No external fact-check URLs attached.';
      sourcesContainer.appendChild(p);
    }

    // Correction Card Image
    if (data.card_image_base64) {
      const imgSrc = `data:image/png;base64,${data.card_image_base64}`;
      correctionCardImg.src = imgSrc;
      btnDownloadCard.href = imgSrc;
      btnDownloadCard.style.display = 'flex';
    } else {
      correctionCardImg.src = '';
      btnDownloadCard.style.display = 'none';
    }

    resultsSection.style.display = 'block';
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function formatTag(tag) {
    return tag
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  // 7. Action Button Handlers
  btnCopyExplanation.addEventListener('click', () => {
    if (lastResultData && lastResultData.text_explanation) {
      navigator.clipboard.writeText(lastResultData.text_explanation).then(() => {
        showToast('Explanation copied to clipboard!');
      }).catch(err => {
        console.error('Clipboard copy failed:', err);
      });
    }
  });

  btnResetCheck.addEventListener('click', () => {
    resultsSection.style.display = 'none';
    textInput.value = '';
    if (btnRemoveImage) btnRemoveImage.click();
    if (btnRemoveAudio) btnRemoveAudio.click();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }
});

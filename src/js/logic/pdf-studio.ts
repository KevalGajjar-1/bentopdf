import { state, resetState } from '../state.js';
import { formatBytes } from '../utils/helpers.js';
import { showAlert } from '../ui.js';
import { createIcons, icons } from 'lucide';

let studioInitialized = false;

function getStudioElements() {
    return {
        modal: document.getElementById('pdf-studio-modal'),
        backBtn: document.getElementById('studio-back-btn'),
        closeBtn: document.getElementById('studio-close-btn'),
        fullscreenBtn: document.getElementById('studio-fullscreen-btn'),
        openFileBtn: document.getElementById('studio-open-file-btn'),
        fileInput: document.getElementById('studio-file-input') as HTMLInputElement | null,
        fileInfo: document.getElementById('studio-file-info'),
        filename: document.getElementById('studio-filename'),
        filesize: document.getElementById('studio-filesize'),
        dropzoneView: document.getElementById('studio-dropzone-view'),
        dropzoneCard: document.getElementById('studio-dropzone-card'),
        selectFileBtn: document.getElementById('studio-select-file-btn'),
        viewerWrapper: document.getElementById('studio-viewer-wrapper'),
        embedContainer: document.getElementById('studio-embed-container'),
    };
}

export function initPdfStudioEvents() {
    if (studioInitialized) return;
    const els = getStudioElements();
    if (!els.modal) return;

    // Back / Close
    els.backBtn?.addEventListener('click', closePdfStudio);
    els.closeBtn?.addEventListener('click', closePdfStudio);

    // Open file button in header
    els.openFileBtn?.addEventListener('click', () => {
        els.fileInput?.click();
    });

    // Select file button in dropzone
    els.selectFileBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        els.fileInput?.click();
    });

    // Dropzone card click
    els.dropzoneCard?.addEventListener('click', () => {
        els.fileInput?.click();
    });

    // File input change
    els.fileInput?.addEventListener('change', (e) => {
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];
        if (file) {
            loadPdfIntoStudio(file);
        }
        input.value = '';
    });

    // Fullscreen toggle
    els.fullscreenBtn?.addEventListener('click', toggleStudioFullscreen);

    document.addEventListener('fullscreenchange', () => {
        const btn = document.getElementById('studio-fullscreen-btn');
        if (!btn) return;
        const isFullscreen = !!document.fullscreenElement;
        btn.innerHTML = isFullscreen 
            ? '<i data-lucide="minimize-2" class="w-4 h-4"></i>'
            : '<i data-lucide="maximize" class="w-4 h-4"></i>';
        createIcons({ icons });
    });

    // Keyboard navigation (Escape to close or exit fullscreen)
    document.addEventListener('keydown', (e) => {
        const modal = document.getElementById('pdf-studio-modal');
        if (!modal || modal.classList.contains('hidden')) return;

        if (e.key === 'Escape' && !document.fullscreenElement) {
            closePdfStudio();
        }
    });

    // Drag and drop on dropzone and modal
    setupStudioDragAndDrop(els);

    studioInitialized = true;
}

function setupStudioDragAndDrop(els: ReturnType<typeof getStudioElements>) {
    const modal = els.modal;
    const card = els.dropzoneCard;
    if (!modal) return;

    ['dragenter', 'dragover'].forEach(eventName => {
        modal.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (card) {
                card.classList.add('border-indigo-500', 'bg-indigo-950/20');
            }
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        modal.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (card) {
                card.classList.remove('border-indigo-500', 'bg-indigo-950/20');
            }
        });
    });

    modal.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const file = dt?.files?.[0];
        if (file) {
            if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
                loadPdfIntoStudio(file);
            } else {
                showAlert('Invalid File', 'Please drop a valid PDF document.');
            }
        }
    });
}

export function openPdfStudio(initialFile?: File) {
    const els = getStudioElements();
    if (!els.modal) return;

    initPdfStudioEvents();

    state.activeTool = 'edit';
    document.body.classList.add('overflow-hidden');
    els.modal.classList.remove('hidden');
    els.modal.classList.add('flex');

    createIcons({ icons });

    if (initialFile) {
        loadPdfIntoStudio(initialFile);
    } else if (state.files && state.files.length > 0 && state.files[0] instanceof File) {
        loadPdfIntoStudio(state.files[0]);
    } else {
        // Show empty dropzone
        showEmptyDropzone(els);
    }
}

export function closePdfStudio() {
    const els = getStudioElements();
    if (!els.modal) return;

    if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
    }

    if (state.currentPdfUrl) {
        URL.revokeObjectURL(state.currentPdfUrl);
        state.currentPdfUrl = null;
    }

    if (els.embedContainer) {
        els.embedContainer.innerHTML = '';
    }

    els.modal.classList.add('hidden');
    els.modal.classList.remove('flex');
    document.body.classList.remove('overflow-hidden');

    resetState();
    window.location.hash = 'tools-header';
}

function showEmptyDropzone(els: ReturnType<typeof getStudioElements>) {
    if (els.fileInfo) {
        els.fileInfo.classList.add('hidden');
        els.fileInfo.classList.remove('flex');
    }
    if (els.viewerWrapper) {
        els.viewerWrapper.classList.add('hidden');
    }
    if (els.embedContainer) {
        els.embedContainer.innerHTML = '';
    }
    if (els.dropzoneView) {
        els.dropzoneView.classList.remove('hidden');
        els.dropzoneView.classList.add('flex');
    }
    createIcons({ icons });
}

export async function loadPdfIntoStudio(file: File) {
    const els = getStudioElements();
    if (!els.modal) return;

    if (!file || (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf')) {
        showAlert('Invalid File', 'Please select a valid PDF file.');
        return;
    }

    state.files = [file];

    // Revoke previous URL if any
    if (state.currentPdfUrl) {
        URL.revokeObjectURL(state.currentPdfUrl);
    }

    const fileURL = URL.createObjectURL(file);
    state.currentPdfUrl = fileURL;

    // Update Header with file details
    if (els.filename) {
        els.filename.textContent = file.name;
        els.filename.title = file.name;
    }
    if (els.filesize) {
        els.filesize.textContent = `(${formatBytes(file.size)})`;
    }
    if (els.fileInfo) {
        els.fileInfo.classList.remove('hidden');
        els.fileInfo.classList.add('flex');
    }

    // Hide dropzone and show viewer
    if (els.dropzoneView) {
        els.dropzoneView.classList.add('hidden');
        els.dropzoneView.classList.remove('flex');
    }
    if (els.viewerWrapper) {
        els.viewerWrapper.classList.remove('hidden');
    }

    if (!els.embedContainer) return;
    els.embedContainer.innerHTML = `
        <div id="studio-loader" class="w-full h-full flex flex-col items-center justify-center bg-gray-950 text-gray-400 gap-3">
            <div class="solid-spinner"></div>
            <p class="text-sm font-medium text-gray-300">Loading document in PDF Studio...</p>
        </div>
    `;

    try {
        // Dynamically import EmbedPDF snippet
        // @ts-ignore
        const module = await import(/* @vite-ignore */ 'https://snippet.embedpdf.com/embedpdf.js');
        const EmbedPDF = module.default || module;

        els.embedContainer.innerHTML = ''; // Clear loader
        EmbedPDF.init({
            type: 'container',
            target: els.embedContainer,
            src: fileURL,
            theme: 'dark',
        });
    } catch (err) {
        console.error('Failed to load EmbedPDF studio:', err);
        if (els.embedContainer) {
            els.embedContainer.innerHTML = `
                <div class="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gray-950">
                    <i data-lucide="alert-triangle" class="w-12 h-12 text-yellow-500 mb-3"></i>
                    <h4 class="text-lg font-bold text-white mb-2">Unable to load PDF Studio</h4>
                    <p class="text-sm text-gray-400 max-w-md mb-4">
                        We could not load the PDF editing engine. Please check your internet connection and try again.
                    </p>
                    <button id="studio-retry-btn" class="btn-gradient px-5 py-2 rounded-lg text-sm text-white font-medium">
                        Retry Loading
                    </button>
                </div>
            `;
            createIcons({ icons });
            document.getElementById('studio-retry-btn')?.addEventListener('click', () => {
                loadPdfIntoStudio(file);
            });
        }
    }

    createIcons({ icons });
}

function toggleStudioFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch((err) => {
            console.warn('Fullscreen request failed:', err);
        });
    } else {
        document.exitFullscreen().catch(() => {});
    }
}

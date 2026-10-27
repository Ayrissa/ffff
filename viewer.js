/** Pan / zoom viewer: mouse wheel + drag on desktop, pinch + drag on touch screens. */
export class Viewer {
    constructor(viewport, stage) {
        this.vp = viewport;
        this.stage = stage;
        this.img = stage.querySelector('img');
        this.s = 1; this.x = 0; this.y = 0; this.base = 1;
        this.iw = 0; this.ih = 0;
        this.ptrs = new Map();
        this.pinch = null;
        this.touched = false;
        this.bind();
    }

    bind() {
        const vp = this.vp;
        this.onWheel = e => {
            if (!this.iw) return;
            e.preventDefault();
            const r = vp.getBoundingClientRect();
            this.zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
        };
        this.onDown = e => {
            if (!this.iw || e.target.closest('.sm-ui')) return;
            try { vp.setPointerCapture(e.pointerId); } catch { /* ignore */ }
            this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (this.ptrs.size === 2) this.pinch = this.measure();
            vp.classList.add('sm-grab');
        };
        this.onMove = e => {
            const p = this.ptrs.get(e.pointerId);
            if (!p) return;
            const dx = e.clientX - p.x, dy = e.clientY - p.y;
            p.x = e.clientX; p.y = e.clientY;
            this.touched = true;
            if (this.ptrs.size === 1) {
                this.x += dx; this.y += dy;
                this.apply();
            } else if (this.ptrs.size === 2 && this.pinch) {
                const now = this.measure();
                const r = vp.getBoundingClientRect();
                this.x += now.cx - this.pinch.cx;
                this.y += now.cy - this.pinch.cy;
                this.zoomAt(now.dist / this.pinch.dist, now.cx - r.left, now.cy - r.top);
                this.pinch = now;
            }
        };
        this.onUp = e => {
            this.ptrs.delete(e.pointerId);
            if (this.ptrs.size < 2) this.pinch = null;
            if (!this.ptrs.size) vp.classList.remove('sm-grab');
        };
        this.onDbl = e => {
            if (!this.iw || e.target.closest('.sm-ui')) return;
            const r = vp.getBoundingClientRect();
            this.zoomAt(this.s < this.base * 1.5 ? 2.2 : 1 / 2.2, e.clientX - r.left, e.clientY - r.top);
        };
        vp.addEventListener('wheel', this.onWheel, { passive: false });
        vp.addEventListener('pointerdown', this.onDown);
        vp.addEventListener('pointermove', this.onMove);
        vp.addEventListener('pointerup', this.onUp);
        vp.addEventListener('pointercancel', this.onUp);
        vp.addEventListener('dblclick', this.onDbl);

        this.ro = new ResizeObserver(() => { if (!this.iw) return; if (this.touched) { this.clamp(); this.apply(); } else this.fit(); });
        this.ro.observe(vp);
    }

    destroy() {
        this.ro?.disconnect();
        const vp = this.vp;
        vp.removeEventListener('wheel', this.onWheel);
        vp.removeEventListener('pointerdown', this.onDown);
        vp.removeEventListener('pointermove', this.onMove);
        vp.removeEventListener('pointerup', this.onUp);
        vp.removeEventListener('pointercancel', this.onUp);
        vp.removeEventListener('dblclick', this.onDbl);
    }

    measure() {
        const [a, b] = [...this.ptrs.values()];
        return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)) };
    }

    setImage(url) {
        return new Promise((resolve, reject) => {
            this.iw = 0;
            this.touched = false;
            this.img.onload = () => {
                this.iw = this.img.naturalWidth;
                this.ih = this.img.naturalHeight;
                this.stage.style.width = this.iw + 'px';
                this.stage.style.height = this.ih + 'px';
                requestAnimationFrame(() => { this.fit(); resolve(); });
            };
            this.img.onerror = () => reject(new Error('image load failed'));
            this.img.src = url;
        });
    }

    clear() {
        this.iw = 0;
        this.img.removeAttribute('src');
    }

    fit() {
        const vw = this.vp.clientWidth, vh = this.vp.clientHeight;
        if (!vw || !vh || !this.iw) return;
        this.base = Math.min(vw / this.iw, vh / this.ih);
        this.s = this.base;
        this.x = (vw - this.iw * this.s) / 2;
        this.y = (vh - this.ih * this.s) / 2;
        this.touched = false;
        this.apply();
    }

    zoomAt(factor, cx, cy) {
        const ns = Math.min(this.base * 10, Math.max(this.base * 0.6, this.s * factor));
        const k = ns / this.s;
        this.x = cx - (cx - this.x) * k;
        this.y = cy - (cy - this.y) * k;
        this.s = ns;
        this.touched = true;
        this.apply();
    }

    zoomBy(factor) {
        this.zoomAt(factor, this.vp.clientWidth / 2, this.vp.clientHeight / 2);
    }

    clamp() {
        const vw = this.vp.clientWidth, vh = this.vp.clientHeight, m = 80;
        this.x = Math.min(vw - m, Math.max(m - this.iw * this.s, this.x));
        this.y = Math.min(vh - m, Math.max(m - this.ih * this.s, this.y));
    }

    apply() {
        this.clamp();
        this.stage.style.transform = `translate(${this.x}px, ${this.y}px) scale(${this.s})`;
        this.vp.style.setProperty('--sm-scale', this.s);
    }
}

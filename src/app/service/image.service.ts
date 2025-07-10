import { Injectable } from "@angular/core";

@Injectable({
    providedIn: 'root'
})
export class ImageService {
    async getAverageColorFromFileOrUrl(fileOrUrl: File | string): Promise<string> {
        const image = await this.loadImage(fileOrUrl);
        return this.getAverageColorFromImage(image);
    }

    private async loadImage(fileOrUrl: File | string): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;

            if (typeof fileOrUrl === 'string') {
                img.src = fileOrUrl;
            } else {
                const reader = new FileReader();
                reader.onload = (e) => {
                    img.src = e.target?.result as string;
                };
                reader.onerror = reject;
                reader.readAsDataURL(fileOrUrl);
            }
        });
    }

    private getAverageColorFromImage(image: HTMLImageElement): string {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas não suportado');

        ctx.drawImage(image, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 4) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            count++;
        }

        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);

        return `rgb(${r},${g},${b})`;
    }
}

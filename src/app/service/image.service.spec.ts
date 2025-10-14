import { TestBed } from '@angular/core/testing';
import { ImageService } from './image.service';

describe('ImageService', () => {
    let service: ImageService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(ImageService);
    });

    it('should compute average color from a tiny canvas image', async () => {
        // create a small red image data URL
        const canvas = document.createElement('canvas');
        canvas.width = 2;
        canvas.height = 2;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = 'rgb(255,0,0)';
        ctx.fillRect(0, 0, 2, 2);
        const dataUrl = canvas.toDataURL();

        const color = await service.getAverageColorFromFileOrUrl(dataUrl);
        expect(color).toContain('rgb(');
    });
});

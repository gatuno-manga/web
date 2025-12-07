import { TestBed } from '@angular/core/testing';
import { ModalNotificationService } from './modal-notification.service';

describe('ModalNotificationService', () => {
    let service: ModalNotificationService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(ModalNotificationService);
    });

    it('should emit modal notification when show is called', (done) => {
        service.modal$.subscribe((modal) => {
            if (modal) {
                try {
                    expect(modal.title).toBe('Title');
                    expect(modal.description).toBe('Desc');
                    expect(modal.type).toBe('info');
                    expect(modal.buttons.length).toBe(2);
                    done();
                } catch (e) {
                    done.fail(e as any);
                }
            }
        });

        service.show('Title', 'Desc', [{ label: 'OK', type: 'primary' } as any, { label: 'Cancel', type: 'primary' } as any]);
    });
});

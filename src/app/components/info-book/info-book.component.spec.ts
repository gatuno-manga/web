import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, EMPTY } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { provideRouter } from '@angular/router';

import { InfoBookComponent } from './info-book.component';
import { BookService } from '../../service/book.service';
import { ModalNotificationService } from '../../service/modal-notification.service';
import { ScrapingStatus } from '../../models/book.models';
import { ContextMenuService } from '../../service/context-menu.service';
import { UserTokenService } from '../../service/user-token.service';

describe('InfoBookComponent', () => {
  let component: InfoBookComponent;
  let fixture: ComponentFixture<InfoBookComponent>;

  let watchSubject: Subject<any>;
  let mockBookService: any;
  let mockModalService: any;
  let mockContextMenuService: any;
  let mockUserTokenService: any;

  beforeEach(async () => {
    watchSubject = new Subject<any>();

    mockBookService = {
      getChapters: jasmine.createSpy('getChapters').and.returnValue(of([{ id: 'c1', title: 'Chapter 1' }])),
      getCovers: jasmine.createSpy('getCovers').and.returnValue(of([{ id: 'cv1', url: 'http://img' }])),
      getInfo: jasmine.createSpy('getInfo').and.returnValue(of({ alternativeTitle: [], originalUrl: ['https://example.com/test'], scrapingStatus: ScrapingStatus.READY, createdAt: new Date(), updatedAt: new Date() })),
      // return EMPTY to avoid triggering window.location.reload() in the component
      selectCover: jasmine.createSpy('selectCover').and.returnValue(EMPTY),
      watchBook: jasmine.createSpy('watchBook').and.returnValue(watchSubject.asObservable()),
    };

    mockModalService = {
      show: jasmine.createSpy('show')
    };

    mockContextMenuService = {
      open: jasmine.createSpy('open')
    };

    mockUserTokenService = {
      isAdminSignal: jasmine.createSpy('isAdminSignal').and.returnValue(false)
    };

    await TestBed.configureTestingModule({
      imports: [InfoBookComponent],
      providers: [
        provideRouter([]),
        { provide: BookService, useValue: mockBookService },
        { provide: ModalNotificationService, useValue: mockModalService },
        { provide: ContextMenuService, useValue: mockContextMenuService },
        { provide: UserTokenService, useValue: mockUserTokenService }
      ]
    })
      .compileComponents();

    fixture = TestBed.createComponent(InfoBookComponent);
    component = fixture.componentInstance;
    // provide an id so ngAfterViewInit can subscribe (watchBook is mocked)
    component.id = 'book-1';
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('urlTransform should return hostname', () => {
    const host = component.urlTransform('https://sub.example.com/path?x=1');
    expect(host).toBe('sub.example.com');
  });

  it('getScrapingStatusClass maps statuses correctly', () => {
    expect(component.getScrapingStatusClass(ScrapingStatus.READY)).toBe('Pronto');
    expect(component.getScrapingStatusClass(ScrapingStatus.PROCESSING)).toBe('Processando');
    expect(component.getScrapingStatusClass(ScrapingStatus.ERROR)).toBe('error');
  });

  it('loadChapters should set chapters from service', () => {
    component.loadChapters();
    expect(mockBookService.getChapters).toHaveBeenCalledWith('book-1');
    expect(component.chapters.length).toBeGreaterThan(0);
    expect(component.chapters[0].title).toBe('Chapter 1');
  });

  it('loadCovers should set covers from service', () => {
    component.loadCovers();
    expect(mockBookService.getCovers).toHaveBeenCalledWith('book-1');
    expect(component.covers.length).toBeGreaterThan(0);
    expect(component.covers[0].id).toBe('cv1');
  });

  it('loadExtraInfo should set extraInfo from service', () => {
    component.loadExtraInfo();
    expect(mockBookService.getInfo).toHaveBeenCalledWith('book-1');
    expect(component.extraInfo.originalUrl && component.extraInfo.originalUrl[0]).toContain('example.com');
  });

  it('selectTab triggers module load function when not loaded', async () => {
    const index = component.tab.covers;
    // replace function with spy that resolves
    component.modulesLoad[index].function = jasmine.createSpy('fn').and.returnValue(Promise.resolve());

    // ensure not loaded
    component.modulesLoad[index].load.set(false);
    component.selectTab(index);

    expect(component.selectedTab).toBe(index);
    expect(component.modulesLoad[index].function).toHaveBeenCalled();
    expect(component.modulesLoad[index].load()).toBeTrue();
  });

  it('selectCover should show modal and call selectCover', (done) => {
    // make modal.show call the confirmation callback immediately
    mockModalService.show.and.callFake((title: string, msg: string, buttons: any[]) => {
      // call the 'Sim' button callback (assumed to be second)
      if (buttons && buttons[1] && typeof buttons[1].callback === 'function') {
        buttons[1].callback();
      }
    });

    const cover = { id: 'cv1', url: 'http://img' } as any;
    component.selectCover(cover);

    // selectCover should call modal.show
    expect(mockModalService.show).toHaveBeenCalled();
    // and then bookService.selectCover should have been called
    setTimeout(() => {
      expect(mockBookService.selectCover).toHaveBeenCalledWith('book-1', 'cv1');
      done();
    }, 0);
  });

  it('websocket events should trigger loads when appropriate', () => {
    // spy on loadChapters
    spyOn(component, 'loadChapters').and.callThrough();

    // ensure selected tab and module load flag
    component.selectedTab = component.tab.chapters;
    component.modulesLoad[component.tab.chapters].load.set(true);

    // emit an event via the subject
    watchSubject.next({ type: 'chapters.updated' });

    expect(component.loadChapters).toHaveBeenCalled();
  });

  it('should toggle sort order and resort chapters', () => {
    component.chapters = [
      { id: 'c1', title: 'C1', index: 1 } as any,
      { id: 'c2', title: 'C2', index: 2 } as any
    ];

    // Set to Ascending manually first to verify toggle to Descending
    component.sortAscending.set(true);
    component.sortChapters();
    expect(component.chapters[0].index).toBe(1);
    expect(component.chapters[1].index).toBe(2);

    component.toggleSort(); // Should switch to Descending (false)
    expect(component.sortAscending()).toBeFalse();
    expect(component.chapters[0].index).toBe(2);
    expect(component.chapters[1].index).toBe(1);
  });

  it('onCoverContextMenu should show Copy and Download Image for non-admin', () => {
    const event = new MouseEvent('contextmenu');
    const cover = { id: 'cv1', url: 'http://img' } as any;

    component.onCoverContextMenu(event, cover);

    expect(mockContextMenuService.open).toHaveBeenCalled();
    const args = mockContextMenuService.open.calls.mostRecent().args;
    expect(args[0]).toBe(event);
    // Non-admin sees 2 items: Copy Image and Download Image
    expect(args[1].length).toBe(2);
    expect(args[1][0].label).toBe('Copiar Imagem');
    expect(args[1][1].label).toBe('Baixar Imagem');
  });

  it('onCoverContextMenu should show Select Cover, Edit and Remove options for admin', () => {
    mockUserTokenService.isAdminSignal.and.returnValue(true);
    const event = new MouseEvent('contextmenu');
    const cover = { id: 'cv1', url: 'http://img' } as any;

    component.onCoverContextMenu(event, cover);

    const args = mockContextMenuService.open.calls.mostRecent().args;
    // Admin sees 7 items: Copy Image, Download Image, Separator, Select, Edit, Separator, Remove
    expect(args[1].length).toBe(7);
    expect(args[1][0].label).toBe('Copiar Imagem');
    expect(args[1][1].label).toBe('Baixar Imagem');
    expect(args[1][2].type).toBe('separator');
    expect(args[1][3].label).toBe('Selecionar Capa');
    expect(args[1][4].label).toBe('Editar');
    expect(args[1][5].type).toBe('separator');
    expect(args[1][6].label).toBe('Remover');
  });
});

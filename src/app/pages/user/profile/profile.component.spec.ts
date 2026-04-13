import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SharedTestingModule } from '@testing/shared-testing.module';
import { ReactiveFormsModule } from '@angular/forms';
import { ProfileComponent } from './profile.component';
import { UserService } from '../../../service/user.service';
import { of } from 'rxjs';
import { UserProfile } from '../../../models/user.models';

describe('ProfileComponent', () => {
	let component: ProfileComponent;
	let fixture: ComponentFixture<ProfileComponent>;
	let userServiceSpy: jasmine.SpyObj<UserService>;

	const mockProfile: UserProfile = {
		id: '1',
		email: 'test@example.com',
		userName: 'testuser',
		name: 'Test User',
		roles: [],
		createdAt: '',
		updatedAt: '',
	};

	beforeEach(async () => {
		userServiceSpy = jasmine.createSpyObj(
			'UserService',
			['updateProfile', 'uploadAvatar', 'uploadBanner'],
			{
				profileSignal: () => mockProfile,
			},
		);

		await TestBed.configureTestingModule({
			imports: [
				ProfileComponent,
				SharedTestingModule,
				ReactiveFormsModule,
			],
			providers: [{ provide: UserService, useValue: userServiceSpy }],
		}).compileComponents();

		fixture = TestBed.createComponent(ProfileComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should initialize the form with profile data', () => {
		expect(component.profileForm.get('userName')?.value).toBe(
			mockProfile.userName,
		);
		expect(component.profileForm.get('name')?.value).toBe(mockProfile.name);
	});

	it('should call updateProfile on saveProfile', () => {
		userServiceSpy.updateProfile.and.returnValue(of(mockProfile));
		component.profileForm.markAsDirty();
		component.saveProfile();
		expect(userServiceSpy.updateProfile).toHaveBeenCalledWith(
			component.profileForm.value,
		);
	});
});

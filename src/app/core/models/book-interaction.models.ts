export interface ReviewBookDto {
	rating: number;
	content: string;
}

export interface BookReview {
	id: string;
	bookId: string;
	userId: string;
	userName: string;
	userAvatar?: string;
	rating: number;
	content: string;
	createdAt: string;
	updatedAt: string;
}

export interface FavoriteResponse {
	bookId: string;
	favorited: boolean;
}

export interface SubscribeResponse {
	bookId: string;
	subscribed: boolean;
}

export interface ReviewBookDto {
	rating: number;
	content: string;
}

export interface FavoriteResponse {
	bookId: string;
	favorited: boolean;
}

export interface SubscribeResponse {
	bookId: string;
	subscribed: boolean;
}

export interface OgImage {
  src: string;
  alt?: string;
}
export interface Image {
  src: string;
  alt?: string;
}

export interface PostFrontmatter {
  layout?: string;
  title: string;
  pubDate: string;
  updatedDate?: string;
  description?: string;
  tags?: string[];
  draft?: boolean;
  ogimage?: string | OgImage;
  image?: Image;
}

export interface Post {
  frontmatter: PostFrontmatter;
  url?: string;
}

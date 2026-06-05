export interface PackageDetails {
  name: string;
  price: number;
  credits: number;
}

export const PACKAGES: Record<string, PackageDetails> = {
  starter: {
    name: "Starter Pack",
    price: 4.99,
    credits: 5,
  },
  pro: {
    name: "Pro Pack",
    price: 9.99,
    credits: 15,
  },
};

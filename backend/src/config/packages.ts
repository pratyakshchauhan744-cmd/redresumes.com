export interface PackageDetails {
  name: string;
  price: number;
  credits: number;
}

export const PACKAGES: Record<string, PackageDetails> = {
  starter: {
    name: "Starter Pack",
    price: 499,
    credits: 5,
  },
  pro: {
    name: "Pro Pack",
    price: 999,
    credits: 15,
  },
};

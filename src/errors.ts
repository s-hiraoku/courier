export class CourierError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CourierError";
  }
}

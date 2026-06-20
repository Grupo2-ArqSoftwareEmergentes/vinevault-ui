import { Observable } from 'rxjs';
import { WineCellar } from './wine-cellar-query-service';

export type CreateWineCellarPayload = Readonly<{
  name: string;
  description: string | null;
  temperatureMin: number;
  temperatureMax: number;
  humidityMin: number;
  humidityMax: number;
}>;

export type UpdateWineCellarPayload = CreateWineCellarPayload;

export abstract class WineCellarCommandService {
  abstract createWineCellar(spaceId: string, payload: CreateWineCellarPayload): Observable<WineCellar>;
  abstract updateWineCellar(wineCellarId: string, payload: UpdateWineCellarPayload): Observable<WineCellar>;
  abstract deleteWineCellar(wineCellarId: string): Observable<void>;
  abstract linkDevice(wineCellarId: string, deviceId: string): Observable<WineCellar>;
  abstract unlinkDevice(wineCellarId: string, deviceId: string): Observable<WineCellar>;
}

import { Injectable } from '@angular/core';

/**
 * Contains the labels for the documents used in the application.
 * User will see these labels instead of the technical document names.
 * If a value isn't found in the docLabels object, the original document name will be returned.
 */
@Injectable({
  providedIn: 'root',
})
export class DocLabelsService {
  private readonly docLabels: Record<string, string> = {
    bible: 'Bibbia',
    publications: 'Pubblicazioni',
    pers: 'Perspicacia',
    cour: 'Coraggio',
  };

  getLabel(doc: string): string {
    return this.docLabels[doc] ?? doc;
  }
}

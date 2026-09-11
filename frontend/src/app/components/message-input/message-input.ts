import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DocLabelsService } from '../../services/docLabels';
import { SttService } from '../../services/stt';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faMicrophone, faStop } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-message-input',
  imports: [FormsModule, FontAwesomeModule],
  templateUrl: './message-input.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './message-input.css',
})
export class MessageInput implements OnChanges {
  private readonly storageKey = 'bibot-selected-documents';

  docLabelsService = inject(DocLabelsService);
  sttService = inject(SttService);

  micIcon = faMicrophone;
  stopIcon = faStop;

  msg = '';
  useTheseDocs: string[] = [];

  @Input() availableDocs: string[] = [];
  @Output() sendMessage = new EventEmitter<{
    message: string;
    categories: string[];
  }>();

  docsOpen = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['availableDocs'] &&
      this.availableDocs.length > 0 &&
      this.useTheseDocs.length === 0
    ) {
      this.loadDocumentPreferences();
    }
  }

  async toggleRecording(): Promise<void> {
    if (this.sttService.isRecording()) {
      await this.stopRecording();
      return;
    }

    await this.startRecording();
  }

  private async startRecording(): Promise<void> {
    try {
      await this.sttService.startRecording();
    } catch (error) {
      console.error("Errore durante l'accesso al microfono:", error);
    }
  }

  private isInvalidTranscription(text: string): boolean {
    const trimmed = text.trim();

    if (!trimmed) {
      return true;
    }

    return (
      (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
      (trimmed.startsWith('*') && trimmed.endsWith('*')) ||
      (trimmed.startsWith('(') && trimmed.endsWith(')')) ||
      (trimmed.startsWith('{') && trimmed.endsWith('}'))
    );
  }

  private async stopRecording(): Promise<void> {
    try {
      let text = await this.sttService.stopRecording();

      if (this.isInvalidTranscription(text)) {
        this.msg = 'Non ti ho sentito, riprova';
      }

      this.msg = this.msg ? `${this.msg} ${text}` : text;
    } catch (error) {
      console.error('Errore durante la trascrizione:', error);
    }
  }

  triggerSendMessage(): void {
    this.sendMessage.emit({
      message: this.msg,
      categories: this.getSelectedDocs(),
    });

    this.msg = '';
  }

  getDocLabel(doc: string): string {
    return this.docLabelsService.getLabel(doc);
  }

  getSelectedDocs(): string[] {
    return [...this.useTheseDocs];
  }

  selectAllDocs(): void {
    this.useTheseDocs = [...this.availableDocs];

    this.saveDocumentPreferences();
  }

  toggleDoc(doc: string): void {
    if (doc === 'publications') {
      this.togglePublications();
      return;
    }

    const isSelected = this.useTheseDocs.includes(doc);

    if (isSelected) {
      // Do not allow the last selected document to be removed.
      if (this.useTheseDocs.length === 1) {
        return;
      }

      let newSelection = this.useTheseDocs.filter((category) => category !== doc);

      // Removing a publication subcategory means that
      // publications is no longer fully selected.
      if (doc !== 'bible') {
        newSelection = newSelection.filter((category) => category !== 'publications');
      }

      // If removing the subcategory also removed the last
      // remaining document, restore the removed document.
      if (newSelection.length === 0) {
        return;
      }

      this.useTheseDocs = newSelection;

      this.saveDocumentPreferences();

      return;
    }

    // Add the selected document.
    let newSelection = [...this.useTheseDocs, doc];

    // If all publication subcategories are selected,
    // automatically select the publications parent.
    if (doc !== 'bible' && this.areAllPublicationCategoriesSelected(newSelection)) {
      newSelection = [
        ...newSelection.filter((category) => category !== 'publications'),
        'publications',
      ];
    }

    this.useTheseDocs = newSelection;

    this.saveDocumentPreferences();
  }

  isPublicationsLocked(): boolean {
    return this.useTheseDocs.includes('publications') && !this.useTheseDocs.includes('bible');
  }

  private togglePublications(): void {
    const publicationsSelected = this.useTheseDocs.includes('publications');

    if (publicationsSelected) {
      // Publications is the only selected document group.
      // Do not allow the selection to become empty.
      if (this.isPublicationsLocked()) {
        return;
      }

      this.useTheseDocs = this.useTheseDocs.filter((category) => category === 'bible');

      this.saveDocumentPreferences();

      return;
    }

    // Selecting Publications selects the parent
    // and all publication subcategories.
    this.useTheseDocs = [
      ...this.useTheseDocs.filter((category) => category === 'bible'),
      'publications',
      ...this.getPublicationCategories(),
    ];

    this.saveDocumentPreferences();
  }

  private getPublicationCategories(): string[] {
    return this.availableDocs.filter(
      (category) => category !== 'bible' && category !== 'publications',
    );
  }

  private areAllPublicationCategoriesSelected(selection: string[]): boolean {
    const publicationCategories = this.getPublicationCategories();

    return (
      publicationCategories.length > 0 &&
      publicationCategories.every((category) => selection.includes(category))
    );
  }

  private loadDocumentPreferences(): void {
    const savedPreferences = localStorage.getItem(this.storageKey);

    if (savedPreferences) {
      try {
        const savedCategories: unknown = JSON.parse(savedPreferences);

        if (Array.isArray(savedCategories)) {
          const validCategories = savedCategories.filter(
            (category): category is string =>
              typeof category === 'string' && this.availableDocs.includes(category),
          );

          if (validCategories.length > 0) {
            this.useTheseDocs = validCategories;
            return;
          }
        }
      } catch {
        // Ignore invalid localStorage data.
      }
    }

    // First launch: select every available document.
    this.useTheseDocs = [...this.availableDocs];

    this.saveDocumentPreferences();
  }

  private saveDocumentPreferences(): void {
    // Never save an empty selection.
    if (this.useTheseDocs.length === 0) {
      return;
    }

    localStorage.setItem(this.storageKey, JSON.stringify(this.useTheseDocs));
  }
}
